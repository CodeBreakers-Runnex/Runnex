package br.com.runnex.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(SleepHealthConnectPlugin.class);
        super.onCreate(state);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getBooleanExtra("runnexHealthPolicy", false) && getBridge() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(
                getBridge().getLocalUrl() + "/termos-e-privacidade"));
        }
    }
}
