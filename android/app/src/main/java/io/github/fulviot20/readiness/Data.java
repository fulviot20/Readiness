package io.github.fulviot20.readiness;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The widget's data: a small encrypted file published next to the app (widget.enc), same passphrase as the app.
 * The passphrase itself is never kept: at set-up it is turned into the key (PBKDF2, 200,000 rounds, the same fixed
 * salt the server uses for published data) and only that key stays in the app's private storage.
 */
final class Data {
    static final String SITE = "https://fulviot20.github.io/Readiness/";
    private static final String PREFS = "readiness", K_KEY = "key", K_LAST = "last", K_AT = "at";

    private Data() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean connected(Context c) {
        return prefs(c).getString(K_KEY, null) != null;
    }

    static byte[] deriveKey(String pass) throws Exception {
        byte[] salt = Arrays.copyOf(MessageDigest.getInstance("SHA-256")
                .digest(("readiness-data-salt:" + pass).getBytes(StandardCharsets.UTF_8)), 16);
        PBEKeySpec spec = new PBEKeySpec(pass.toCharArray(), salt, 200000, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    }

    static void saveKey(Context c, byte[] key) {
        prefs(c).edit().putString(K_KEY, Base64.encodeToString(key, Base64.NO_WRAP)).apply();
    }

    static void forget(Context c) {
        prefs(c).edit().clear().apply();
    }

    private static String http(String url) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(8000);
        h.setReadTimeout(8000);
        h.setUseCaches(false);
        try (InputStream in = h.getInputStream()) {
            if (h.getResponseCode() != 200) throw new Exception("HTTP " + h.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } finally {
            h.disconnect();
        }
    }

    /** Downloads and decrypts the widget file with the given key. Throws if the network or the key fails. */
    static JSONObject fetch(byte[] key) throws Exception {
        JSONObject env = new JSONObject(http(SITE + "widget.enc?t=" + System.currentTimeMillis()));
        byte[] iv = Base64.decode(env.getString("iv"), Base64.DEFAULT);
        byte[] ct = Base64.decode(env.getString("ct"), Base64.DEFAULT);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        return new JSONObject(new String(c.doFinal(ct), StandardCharsets.UTF_8));
    }

    /** Fresh data if it can be had, saved for next time; null when offline or not set up. */
    static JSONObject refresh(Context c) {
        String k = prefs(c).getString(K_KEY, null);
        if (k == null) return null;
        try {
            JSONObject o = fetch(Base64.decode(k, Base64.DEFAULT));
            prefs(c).edit().putString(K_LAST, o.toString()).putLong(K_AT, System.currentTimeMillis()).apply();
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    /** The last data seen, or null. */
    static JSONObject last(Context c) {
        try {
            String s = prefs(c).getString(K_LAST, null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }
}
