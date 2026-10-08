package br.com.runnex.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Abre a mesma política usada pelo app, sem manter uma cópia nativa divergente. */
public class HealthPermissionsActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        startActivity(new Intent(this, MainActivity.class)
            .putExtra("runnexHealthPolicy", true)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        finish();
    }
}
