package it.uvsf7.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

/**
 * Espone i file dentro `files/apk` come content:// — serve all'installer di
 * sistema per leggere l'APK scaricato.
 *
 * Da Android 7 (API 24) passare un `file://` a un'altra app fa scattare
 * FileUriExposedException: il ContentProvider è il modo corretto, e non
 * richiede AndroidX (FileProvider di androidx non è disponibile qui perché
 * l'app non ha dipendenze).
 */
public class ApkProvider extends ContentProvider {

    public static final String AUTORITA = "it.uvsf7.app.apk";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String modo) throws FileNotFoundException {
        List<String> segmenti = uri.getPathSegments();
        if (segmenti.isEmpty()) {
            throw new FileNotFoundException("percorso vuoto");
        }

        String nome = segmenti.get(segmenti.size() - 1);
        // niente salite di directory: solo file dentro la cartella apk
        if (nome.contains("/") || nome.contains("..")) {
            throw new FileNotFoundException("nome non valido");
        }

        File cartella = new File(getContext().getExternalFilesDir(null), "apk");
        File file = new File(cartella, nome);
        if (!file.exists()) {
            throw new FileNotFoundException(file.getAbsolutePath());
        }

        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public Cursor query(Uri uri, String[] proiezione, String selezione,
                        String[] argomentiSelezione, String ordine) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues valori) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selezione, String[] argomentiSelezione) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues valori, String selezione, String[] argomentiSelezione) {
        return 0;
    }
}
