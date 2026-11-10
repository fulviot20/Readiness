package io.github.fulviot20.readiness;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

/** One screen: type the passphrase once, then put the widget on the Home screen. */
public class SetupActivity extends Activity {
    private TextView status;
    private EditText pass;
    private Button save, add, open, forget;

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private Button button(String label, boolean primary) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(primary ? 0xFF121A26 : 0xFFECEFF4);
        b.getBackground().setTint(primary ? 0xFF6FD3E6 : 0xFF212D3F);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        lp.topMargin = dp(12);
        b.setLayoutParams(lp);
        return b;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF121A26);
        getWindow().setNavigationBarColor(0xFF121A26);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(24), dp(56), dp(24), dp(32));
        col.setBackgroundColor(0xFF121A26);

        TextView title = new TextView(this);
        title.setText("Readiness");
        title.setTextSize(34);
        title.setTextColor(0xFFECEFF4);
        title.setTypeface(Typeface.create("sans-serif-condensed-light", Typeface.NORMAL));
        col.addView(title);

        TextView sub = new TextView(this);
        sub.setText("The widget for your Home screen: today's score, sleep and strain. It reads the same encrypted data as the app, so it needs the same passphrase, once.");
        sub.setTextSize(15);
        sub.setTextColor(0xFF8C98AB);
        sub.setPadding(0, dp(8), 0, dp(20));
        sub.setLineSpacing(dp(3), 1f);
        col.addView(sub);

        pass = new EditText(this);
        pass.setHint("Passphrase");
        pass.setHintTextColor(0xFF5F6C80);
        pass.setTextColor(0xFFECEFF4);
        pass.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pass.setSingleLine(true);
        col.addView(pass, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));

        save = button("Connect", true);
        add = button("Add the widget to the Home screen", true);
        open = button("Open Readiness", false);
        forget = button("Disconnect this widget", false);
        col.addView(save);
        col.addView(add);
        col.addView(open);
        col.addView(forget);

        status = new TextView(this);
        status.setTextSize(14.5f);
        status.setTextColor(0xFF8C98AB);
        status.setPadding(0, dp(18), 0, 0);
        status.setLineSpacing(dp(3), 1f);
        status.setGravity(Gravity.START);
        col.addView(status);

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(0xFF121A26);
        sv.setFillViewport(true);
        sv.addView(col);
        setContentView(sv);

        save.setOnClickListener(v -> connect());
        add.setOnClickListener(v -> pin());
        open.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Data.SITE))));
        forget.setOnClickListener(v -> {
            Data.forget(this);
            ScoreWidget.drawAll(this);
            show("Disconnected.");
        });
        show(null);
    }

    private void show(String msg) {
        boolean on = Data.connected(this);
        pass.setVisibility(on ? View.GONE : View.VISIBLE);
        save.setVisibility(on ? View.GONE : View.VISIBLE);
        add.setVisibility(on ? View.VISIBLE : View.GONE);
        forget.setVisibility(on ? View.VISIBLE : View.GONE);
        save.setEnabled(true);
        if (msg != null) status.setText(msg);
        else if (on) status.setText("Connected. The widget refreshes by itself about every 15 minutes; tapping it opens Readiness.");
        else status.setText("");
    }

    private void connect() {
        final String p = pass.getText().toString().trim();
        if (p.isEmpty()) return;
        save.setEnabled(false);
        status.setText("Checking…");
        new Thread(() -> {
            String msg;
            try {
                byte[] key = Data.deriveKey(p);
                JSONObject o;
                try {
                    o = Data.fetch(key);
                } catch (javax.crypto.AEADBadTagException e) {
                    throw new Exception("That passphrase doesn't match.");
                } catch (java.io.IOException e) {
                    throw new Exception("No connection, or the data isn't published yet. Try again in a few minutes.");
                }
                Data.saveKey(this, key);
                Data.refresh(this);
                ScoreWidget.drawAll(this);
                RefreshJob.schedule(this);
                msg = "Connected" + (o.isNull("score") ? "." : ": today's score is " + o.optInt("score") + ".")
                        + " Now add the widget to your Home screen.";
            } catch (Exception e) {
                msg = e.getMessage() == null ? "Something went wrong. Try again." : e.getMessage();
            }
            final String m = msg;
            runOnUiThread(() -> {
                pass.setText("");
                show(m);
            });
        }).start();
    }

    private void pin() {
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        if (mgr.isRequestPinAppWidgetSupported()) {
            mgr.requestPinAppWidget(new ComponentName(this, ScoreWidget.class), null, null);
        } else {
            status.setText("Long-press an empty spot on the Home screen, choose Widgets, then Readiness.");
        }
    }
}
