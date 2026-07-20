package ai.opencode.remote.web;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(LiveEventsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
