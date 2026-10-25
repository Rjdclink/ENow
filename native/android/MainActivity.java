package app.enow.shopping;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
  private static final String HOME="https://e-verse.eager-guppy-9296.chatgpt.site/";
  private WebView web;
  private LinearLayout root,bar;
  private TextView address;
  private ValueCallback<Uri[]> chooser;
  private String failedURL;

  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(238,245,239));
    getWindow().setNavigationBarColor(Color.rgb(238,245,239));
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setFitsSystemWindows(true);root.setBackgroundColor(Color.rgb(248,250,246));setContentView(root);
    bar=new LinearLayout(this);bar.setGravity(android.view.Gravity.CENTER_VERTICAL);bar.setPadding(12,4,12,4);bar.setVisibility(View.GONE);
    Button home=new Button(this);home.setText("← e-verse");home.setOnClickListener(v->web.loadUrl(HOME));bar.addView(home);
    address=new TextView(this);address.setTextColor(Color.rgb(33,91,67));address.setTextSize(12);address.setMaxLines(2);bar.addView(address,new LinearLayout.LayoutParams(0,-2,1));root.addView(bar);
    web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));web.setBackgroundColor(Color.rgb(248,250,246));
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setUserAgentString(settings.getUserAgentString()+" e-verse/1.2.0");
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){return navigate(req.getUrl());}
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){updateBar(url);}
      @Override public void onPageFinished(WebView view,String url){updateBar(url);}
      @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame()){failedURL=req.getUrl().toString();new AlertDialog.Builder(MainActivity.this).setTitle("Unable to connect").setMessage("Check your internet connection, then try again.").setPositiveButton("Retry",(d,w)->web.loadUrl(failedURL)).setNegativeButton("e-verse home",(d,w)->web.loadUrl(HOME)).show();}}
      @Override public boolean onRenderProcessGone(WebView view,android.webkit.RenderProcessGoneDetail detail){root.removeView(view);view.destroy();web=null;recreate();return true;}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("image/*");
        try{startActivityForResult(pick,42);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;
      }
      @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean gesture,android.os.Message message){
        if(!gesture)return false;
        WebView popup=new WebView(MainActivity.this);
        popup.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){Uri uri=req.getUrl();if(!navigate(uri)&&"https".equals(uri.getScheme()))web.loadUrl(uri.toString());v.destroy();return true;}});
        ((WebView.WebViewTransport)message.obj).setWebView(popup);message.sendToTarget();return true;
      }
    });
    web.setDownloadListener((url,ua,disposition,type,size)->{if("https".equals(Uri.parse(url).getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){}}});
    if(state==null||web.restoreState(state)==null)web.loadUrl(HOME);
  }
  private boolean paymentHost(String host){return "cash.app".equals(host)||"venmo.com".equals(host)||"account.venmo.com".equals(host)||"www.paypal.com".equals(host)||"app.chime.com".equals(host)||"www.chime.com".equals(host);}
  private boolean navigate(Uri uri){
    String scheme=uri.getScheme(),host=uri.getHost();
    if("https".equals(scheme)){
      if(paymentHost(host)){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}catch(Exception ignored){return false;}}
      return false;
    }
    if("tel".equals(scheme)||"mailto".equals(scheme)||"venmo".equals(scheme)){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}}
    return true;
  }
  private void updateBar(String url){Uri u=Uri.parse(url);boolean own=Uri.parse(HOME).getHost().equals(u.getHost());bar.setVisibility(own?View.GONE:View.VISIBLE);address.setText(u.getHost()==null?"":u.getHost());}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==42&&chooser!=null){Uri[] values=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null)values=new Uri[]{data.getData()};chooser.onReceiveValue(values);chooser=null;}}
  @Override public void onBackPressed(){web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",value->{if(!"true".equals(value)){if(web.canGoBack())web.goBack();else finish();}});}
  @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(web!=null)web.loadUrl(HOME);}
  @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(web!=null)web.saveState(state);}
  @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
  @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.dispatchEvent(new Event('pageshow'))",null);}}
  @Override protected void onDestroy(){if(chooser!=null)chooser.onReceiveValue(null);if(web!=null)web.destroy();super.onDestroy();}
}
