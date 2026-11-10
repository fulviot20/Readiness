package io.github.fulviot20.readiness;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The home-screen widget: the same ring as the app (score in the middle, colour of the band), with sleep and strain.
 * It is drawn as a picture so it looks the same on every launcher. Tapping it opens Readiness.
 */
public class ScoreWidget extends AppWidgetProvider {
    private static final int TEXT = 0xFFECEFF4, MUTED = 0xFF8C98AB, FAINT = 0xFF5F6C80, TRACK = 0x12FFFFFF;

    @Override
    public void onUpdate(final Context c, AppWidgetManager mgr, int[] ids) {
        drawAll(c);                                   // at once, with what we have
        RefreshJob.schedule(c);
        final PendingResult pending = goAsync();      // then with fresh data
        new Thread(() -> {
            try {
                if (Data.refresh(c) != null) drawAll(c);
            } finally {
                pending.finish();
            }
        }).start();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle opts) {
        drawAll(c);
    }

    @Override
    public void onDisabled(Context c) {
        RefreshJob.cancel(c);
    }

    static void drawAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, ScoreWidget.class))) {
            Bundle o = mgr.getAppWidgetOptions(id);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 160);
            int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 160);
            RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget);
            rv.setImageViewBitmap(R.id.pic, picture(c, Math.max(w, 60), Math.max(h, 40)));
            rv.setOnClickPendingIntent(R.id.pic, open(c));
            mgr.updateAppWidget(id, rv);
        }
    }

    /** Opens the installed Readiness web app when there is one, otherwise the page in the browser. */
    private static PendingIntent open(Context c) {
        Intent i;
        if (!Data.connected(c)) {
            i = new Intent(c, SetupActivity.class);
        } else {
            i = new Intent(Intent.ACTION_VIEW, Uri.parse(Data.SITE));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            try {
                for (ResolveInfo r : c.getPackageManager().queryIntentActivities(i, 0)) {
                    String p = r.activityInfo.packageName;
                    if (p != null && p.contains("webapk")) {
                        i.setPackage(p);
                        break;
                    }
                }
            } catch (Exception ignored) { }
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int bandColor(String band) {
        if ("Super".equals(band)) return 0xFF4AA3FF;
        if ("Normal".equals(band)) return 0xFF34D399;
        if ("Low".equals(band)) return 0xFFF7C948;
        if ("Very low".equals(band)) return 0xFFFF5D6C;
        return FAINT;
    }

    private static Paint text(int color, float size, Typeface tf, Paint.Align align) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        p.setColor(color);
        p.setTextSize(size);
        p.setTypeface(tf);
        p.setTextAlign(align);
        return p;
    }

    /** The widget as a picture of w x h dp. Square-ish: ring above, sleep and strain below. Wide: ring left, text right. */
    private static Bitmap picture(Context c, int wDp, int hDp) {
        float d = Math.min(c.getResources().getDisplayMetrics().density, 900f / Math.max(wDp, hDp));
        int W = Math.round(wDp * d), H = Math.round(hDp * d);
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        Typeface light = Typeface.create("sans-serif-condensed-light", Typeface.NORMAL);
        Typeface cond = Typeface.create("sans-serif-condensed", Typeface.NORMAL);
        Typeface med = Typeface.create("sans-serif-medium", Typeface.NORMAL);

        JSONObject o = Data.last(c);
        boolean setUp = Data.connected(c);
        String today = LocalDate.now(ZoneId.of("Europe/Rome")).toString();
        boolean fresh = o != null && today.equals(o.optString("date"));
        boolean has = fresh && !o.isNull("score");
        int score = has ? o.optInt("score") : 0;
        String band = has ? o.optString("band", "") : "";
        String sleep = fresh && !o.isNull("sleep") ? String.valueOf(o.optInt("sleep")) : "–";
        String strain = fresh && !o.isNull("strain") ? String.valueOf(o.optInt("strain")) : "–";
        String note = !setUp ? "Tap to set up" : o == null ? "Waiting for data" : has ? band.toUpperCase() : "WAITING FOR LAST NIGHT";

        boolean wide = W > H * 1.5f;
        float pad = 12 * d;
        float ringSize = wide ? H - 2 * pad : Math.min(W - 2 * pad, (H - 2 * pad) * 0.80f);
        float cx = wide ? pad + ringSize / 2 : W / 2f;
        float cy = wide ? H / 2f : pad + ringSize / 2;
        float stroke = Math.max(4 * d, ringSize * 0.085f);
        float r = (ringSize - stroke) / 2;

        Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(stroke);
        ring.setColor(TRACK);
        cv.drawCircle(cx, cy, r, ring);
        if (has) {
            ring.setColor(bandColor(band));
            ring.setStrokeCap(Paint.Cap.ROUND);
            cv.drawArc(new RectF(cx - r, cy - r, cx + r, cy + r), -90, 360f * Math.max(1, Math.min(100, score)) / 100f, false, ring);
        }
        Paint num = text(TEXT, ringSize * 0.42f, light, Paint.Align.CENTER);
        float numY = cy - (num.ascent() + num.descent()) / 2 - (wide ? 0 : ringSize * 0.04f);
        cv.drawText(has ? String.valueOf(score) : "–", cx, numY, num);

        if (wide) {
            float x = pad + ringSize + 14 * d, line = H / 4.2f;
            Paint head = text(has ? bandColor(band) : MUTED, Math.min(15 * d, line * 0.62f), med, Paint.Align.LEFT);
            head.setLetterSpacing(0.06f);
            cv.drawText(note, x, H / 2f - line * 0.55f, head);
            Paint body = text(MUTED, Math.min(15 * d, line * 0.62f), cond, Paint.Align.LEFT);
            cv.drawText("Sleep " + sleep + "   ·   Strain " + strain, x, H / 2f + line * 0.75f, body);
        } else {
            Paint lab = text(has ? bandColor(band) : MUTED, ringSize * (note.length() > 9 ? 0.058f : 0.085f), med, Paint.Align.CENTER);
            lab.setLetterSpacing(0.08f);
            cv.drawText(note, cx, cy + ringSize * 0.27f, lab);
            float y = pad + ringSize + (H - pad - ringSize) * 0.62f;
            Paint body = text(MUTED, Math.min(13.5f * d, (H - pad - ringSize) * 0.42f), cond, Paint.Align.CENTER);
            cv.drawText("Sleep " + sleep + "  ·  Strain " + strain, W / 2f, y, body);
        }
        return bmp;
    }
}
