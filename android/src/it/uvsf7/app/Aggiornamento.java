package it.uvsf7.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Aggiornamento dell'APK dalle Release GitHub.
 *
 * Il gioco si aggiorna da solo (è una pagina remota), ma il contenitore nativo
 * no: quando cambia il codice Java o si vuole una nuova versione, si pubblica
 * un APK come asset di una Release e le app installate se ne accorgono.
 *
 * Versione attesa nel tag della Release: `app-vX.Y.Z` (es. app-v1.0.1), oppure
 * qualunque tag purché esista un asset `.apk`.
 */
public final class Aggiornamento {

    /** Ultima release pubblicata sul repository del gioco. */
    private static final String API_RELEASE =
            "https://api.github.com/repos/priestsn/uvstf7/releases/latest";

    private Aggiornamento() {
    }

    /**
     * Controlla se esiste una versione nuova.
     *
     * @param attivita  activity che ospita l'app (per il dialogo)
     * @param silenzioso true = non disturbare se è tutto aggiornato
     */
    public static void controlla(final Activity attivita, final boolean silenzioso) {
        new Thread(() -> {
            try {
                JSONObject release = scaricaJson(API_RELEASE);
                final String tag = release.optString("tag_name", "");
                final String versioneNuova = versioneDaTag(tag);
                final String versioneAttuale = versioneInstallata(attivita);
                final String urlApk = trovaApk(release);

                if (urlApk == null || versioneNuova == null) {
                    if (!silenzioso) {
                        avvisa(attivita, "Nessun APK nelle Release");
                    }
                    return;
                }

                if (confronta(versioneNuova, versioneAttuale) <= 0) {
                    if (!silenzioso) {
                        avvisa(attivita, "Già aggiornato (v" + versioneAttuale + ")");
                    }
                    return;
                }

                new Handler(Looper.getMainLooper()).post(() ->
                        new AlertDialog.Builder(attivita)
                                .setTitle("Aggiornamento disponibile")
                                .setMessage("Versione " + versioneNuova
                                        + " (installata " + versioneAttuale + ")")
                                .setPositiveButton("Scarica e installa",
                                        (d, w) -> scaricaEInstalla(attivita, urlApk, versioneNuova))
                                .setNegativeButton("Dopo", null)
                                .show());

            } catch (Exception e) {
                if (!silenzioso) {
                    avvisa(attivita, "Controllo non riuscito: " + e.getClass().getSimpleName());
                }
            }
        }).start();
    }

    // ------------------------------------------------------------------

    private static void scaricaEInstalla(final Activity attivita, final String urlApk,
                                         final String versione) {
        Toast.makeText(attivita, "Scarico la versione " + versione + "…", Toast.LENGTH_SHORT).show();

        new Thread(() -> {
            try {
                File cartella = new File(attivita.getExternalFilesDir(null), "apk");
                if (!cartella.exists() && !cartella.mkdirs()) {
                    throw new IllegalStateException("cartella non creabile");
                }
                File destinazione = new File(cartella, "uvsf7-" + versione + ".apk");

                HttpURLConnection connessione = (HttpURLConnection) new URL(urlApk).openConnection();
                connessione.setInstanceFollowRedirects(true);
                connessione.setConnectTimeout(20000);
                connessione.setReadTimeout(60000);
                connessione.setRequestProperty("User-Agent", "uvsf7-app");
                try (InputStream ingresso = connessione.getInputStream();
                     FileOutputStream uscita = new FileOutputStream(destinazione)) {
                    byte[] buffer = new byte[8192];
                    int letti;
                    while ((letti = ingresso.read(buffer)) > 0) {
                        uscita.write(buffer, 0, letti);
                    }
                }

                new Handler(Looper.getMainLooper()).post(() -> installa(attivita, destinazione));
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() ->
                        avvisa(attivita, "Download non riuscito: " + e.getClass().getSimpleName()));
            }
        }).start();
    }

    /** Apre l'installer di sistema sull'APK scaricato. */
    private static void installa(Activity attivita, File apk) {
        // da Android 8 serve il permesso esplicito a installare app da questa fonte
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !attivita.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(attivita)
                    .setTitle("Serve un permesso")
                    .setMessage("Consenti all'app di installare aggiornamenti, poi riprova.")
                    .setPositiveButton("Apri impostazioni", (d, w) -> {
                        Intent intento = new Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + attivita.getPackageName()));
                        attivita.startActivity(intento);
                    })
                    .setNegativeButton("Annulla", null)
                    .show();
            return;
        }

        Uri uri = Uri.parse("content://" + ApkProvider.AUTORITA + "/" + apk.getName());
        Intent intento = new Intent(Intent.ACTION_VIEW);
        intento.setDataAndType(uri, "application/vnd.android.package-archive");
        intento.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        attivita.startActivity(intento);
    }

    // ------------------------------------------------------------------
    // Aiutanti
    // ------------------------------------------------------------------

    private static JSONObject scaricaJson(String indirizzo) throws Exception {
        HttpURLConnection connessione = (HttpURLConnection) new URL(indirizzo).openConnection();
        connessione.setConnectTimeout(15000);
        connessione.setReadTimeout(20000);
        connessione.setRequestProperty("User-Agent", "uvsf7-app");
        connessione.setRequestProperty("Accept", "application/vnd.github+json");
        try (InputStream ingresso = connessione.getInputStream()) {
            java.io.ByteArrayOutputStream accumulo = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int letti;
            while ((letti = ingresso.read(buffer)) > 0) {
                accumulo.write(buffer, 0, letti);
            }
            return new JSONObject(new String(accumulo.toByteArray(), "UTF-8"));
        }
    }

    /** Primo asset con estensione .apk, oppure null. */
    private static String trovaApk(JSONObject release) {
        JSONArray asset = release.optJSONArray("assets");
        if (asset == null) {
            return null;
        }
        for (int i = 0; i < asset.length(); i++) {
            JSONObject voce = asset.optJSONObject(i);
            if (voce == null) {
                continue;
            }
            String nome = voce.optString("name", "");
            if (nome.toLowerCase().endsWith(".apk")) {
                return voce.optString("browser_download_url", null);
            }
        }
        return null;
    }

    /** "app-v1.2.3" → "1.2.3" (accetta anche tag senza prefisso). */
    private static String versioneDaTag(String tag) {
        if (tag == null || tag.isEmpty()) {
            return null;
        }
        String solo = tag.replaceAll("^[^0-9]*", "");
        return solo.isEmpty() ? null : solo;
    }

    private static String versioneInstallata(Context contesto) {
        try {
            return contesto.getPackageManager()
                    .getPackageInfo(contesto.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    /** Confronto per parti numeriche: >0 se a è più recente di b. */
    static int confronta(String a, String b) {
        String[] sinistra = a.split("\\.");
        String[] destra = (b == null ? "0" : b).split("\\.");
        int passi = Math.max(sinistra.length, destra.length);
        for (int i = 0; i < passi; i++) {
            int x = numero(sinistra, i);
            int y = numero(destra, i);
            if (x != y) {
                return x - y;
            }
        }
        return 0;
    }

    private static int numero(String[] parti, int indice) {
        if (indice >= parti.length) {
            return 0;
        }
        try {
            return Integer.parseInt(parti[indice].replaceAll("[^0-9].*$", ""));
        } catch (Exception e) {
            return 0;
        }
    }

    private static void avvisa(Activity attivita, String testo) {
        new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(attivita, testo, Toast.LENGTH_SHORT).show());
    }
}
