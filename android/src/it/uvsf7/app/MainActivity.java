package it.uvsf7.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Contenitore nativo del gioco.
 *
 * L'app non contiene il gioco: carica l'indirizzo configurato (di serie la
 * versione pubblicata dal repository), quindi ogni modifica pushatа sul repo
 * arriva sul telefono alla riapertura, senza reinstallare nulla.
 *
 * Gesti utili:
 * - tre dita sullo schermo → impostazioni (indirizzo del server, aggiornamenti)
 * - indietro indietro → esce (evita uscite accidentali durante il combattimento)
 */
public class MainActivity extends Activity {

    /** Indirizzo di gioco di serie: la versione pubblicata dal repository. */
    static final String URL_PREDEFINITO = "https://priestsn.github.io/ProjectoTps/";

    /** Dopo quanto tempo in background ricaricare per prendere l'ultima versione. */
    private static final long RICARICA_DOPO_MS = 5 * 60 * 1000L;

    private WebView web;
    private SharedPreferences prefs;
    private long ultimaPausa = 0;
    private long ultimoIndietro = 0;
    private boolean erroreMostrato = false;

    @Override
    protected void onCreate(Bundle stato) {
        super.onCreate(stato);
        prefs = getSharedPreferences("uvsf7", MODE_PRIVATE);

        // il gioco non ha senso con lo schermo che si spegne
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        schermoIntero();

        FrameLayout radice = new FrameLayout(this);
        radice.setBackgroundColor(Color.BLACK);

        web = new WebView(this);
        configuraWebView();
        radice.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(radice);

        web.loadUrl(indirizzo());

        // controllo aggiornamenti APK in sottofondo, senza disturbare
        Aggiornamento.controlla(this, true);
    }

    // ------------------------------------------------------------------
    // WebView
    // ------------------------------------------------------------------

    private void configuraWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // il gioco disegna il proprio canvas: niente zoom né scroll della pagina
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);

        // se il server è raggiunto in http e la pagina in https (o viceversa)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.addJavascriptInterface(new Ponte(), "Android");

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest richiesta) {
                Uri destinazione = richiesta.getUrl();
                String schema = destinazione.getScheme() == null ? "" : destinazione.getScheme();
                // tutto ciò che non è il gioco (mailto, tel, altri siti) va nel browser
                if (!schema.equals("http") && !schema.equals("https")) {
                    apriFuori(destinazione);
                    return true;
                }
                String base = Uri.parse(indirizzo()).getHost();
                if (base != null && !base.equals(destinazione.getHost())) {
                    apriFuori(destinazione);
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView vista, WebResourceRequest richiesta, WebResourceError errore) {
                // solo l'errore della pagina principale merita la schermata di errore
                if (richiesta.isForMainFrame() && !erroreMostrato) {
                    erroreMostrato = true;
                    mostraPaginaErrore();
                }
            }

            @Override
            public void onPageFinished(WebView vista, String url) {
                erroreMostrato = false;
            }
        });
    }

    /** Pagina locale mostrata quando il server non risponde. */
    private void mostraPaginaErrore() {
        String html = "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<style>body{margin:0;height:100vh;display:flex;flex-direction:column;"
                + "align-items:center;justify-content:center;gap:18px;background:#050505;color:#eee;"
                + "font-family:sans-serif;text-align:center;padding:24px}"
                + "h1{font-size:20px;margin:0}p{color:#9a9a9a;font-size:14px;max-width:34ch;line-height:1.5}"
                + "button{padding:14px 24px;font-size:16px;color:#eee;background:#1b1b1b;"
                + "border:2px solid #6a6a6a;border-radius:8px}"
                + "</style></head><body>"
                + "<h1>Server non raggiungibile</h1>"
                + "<p>Controlla la connessione, oppure l'indirizzo del server nelle impostazioni "
                + "(tre dita sullo schermo).</p>"
                + "<button onclick=\"Android.riprova()\">RIPROVA</button>"
                + "<button onclick=\"Android.impostazioni()\">IMPOSTAZIONI</button>"
                + "</body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    // ------------------------------------------------------------------
    // Impostazioni (tre dita sullo schermo)
    // ------------------------------------------------------------------

    private void mostraImpostazioni() {
        final EditText campo = new EditText(this);
        campo.setText(indirizzo());
        campo.setSingleLine(true);

        new AlertDialog.Builder(this)
                .setTitle("Impostazioni")
                .setMessage("Indirizzo del gioco (la pagina che l'app carica):")
                .setView(campo)
                .setPositiveButton("Salva e ricarica", (d, w) -> {
                    String nuovo = campo.getText().toString().trim();
                    if (!nuovo.startsWith("http")) {
                        nuovo = "https://" + nuovo;
                    }
                    if (!nuovo.endsWith("/")) {
                        nuovo = nuovo + "/";
                    }
                    prefs.edit().putString("url", nuovo).apply();
                    erroreMostrato = false;
                    web.loadUrl(nuovo);
                })
                .setNeutralButton("Aggiorna app", (d, w) -> Aggiornamento.controlla(this, false))
                .setNegativeButton("Chiudi", null)
                .show();
    }

    /** Ponte fra la pagina di errore/il gioco e l'app nativa. */
    public class Ponte {
        @JavascriptInterface
        public void riprova() {
            runOnUiThread(() -> {
                erroreMostrato = false;
                web.loadUrl(indirizzo());
            });
        }

        @JavascriptInterface
        public void impostazioni() {
            runOnUiThread(MainActivity.this::mostraImpostazioni);
        }

        @JavascriptInterface
        public String versione() {
            return nomeVersione();
        }

        @JavascriptInterface
        public boolean appNativa() {
            return true;
        }
    }

    // ------------------------------------------------------------------
    // Ciclo di vita e comandi
    // ------------------------------------------------------------------

    @Override
    protected void onPause() {
        super.onPause();
        ultimaPausa = System.currentTimeMillis();
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        schermoIntero();
        // tornando dopo un po', ricarica: se nel frattempo è cambiato il gioco
        // sul repository, l'utente lo trova aggiornato
        if (ultimaPausa > 0 && System.currentTimeMillis() - ultimaPausa > RICARICA_DOPO_MS) {
            web.reload();
        }
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent evento) {
        // tre dita = impostazioni (gesto che il gioco non usa)
        if (evento.getPointerCount() >= 3 && evento.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN) {
            mostraImpostazioni();
            return true;
        }
        return super.dispatchTouchEvent(evento);
    }

    @Override
    public boolean onKeyDown(int tasto, KeyEvent evento) {
        if (tasto == KeyEvent.KEYCODE_BACK) {
            long ora = System.currentTimeMillis();
            if (ora - ultimoIndietro < 2000) {
                finish();
                return true;
            }
            ultimoIndietro = ora;
            Toast.makeText(this, "Premi di nuovo INDIETRO per uscire", Toast.LENGTH_SHORT).show();
            return true;
        }
        return super.onKeyDown(tasto, evento);
    }

    // ------------------------------------------------------------------
    // Aiutanti
    // ------------------------------------------------------------------

    private void schermoIntero() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    String indirizzo() {
        return prefs.getString("url", URL_PREDEFINITO);
    }

    private String nomeVersione() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private void apriFuori(Uri destinazione) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, destinazione));
        } catch (Exception e) {
            Toast.makeText(this, "Nessuna app per aprire questo link", Toast.LENGTH_SHORT).show();
        }
    }
}
