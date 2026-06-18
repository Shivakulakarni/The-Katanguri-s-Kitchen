'use client';

/* eslint-disable prefer-rest-params, no-var, @typescript-eslint/no-unused-expressions */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    mixpanel: any;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

export function initAnalytics() {
  if (typeof window === 'undefined') return;

  // GA is initialized via the GoogleAnalytics component (Next.js Script)
  // Only initialize Mixpanel if configured
  if (MIXPANEL_TOKEN && !window.mixpanel) {
    (function(f: Document, b: any){
      if(!b.__SV){
        var a: HTMLScriptElement, e: Element, g: number;
        window.mixpanel=b;
        b._i=[];
        b.init=function(a: any, e: any, d: any){
          function f(b: any, h: any){
            var a=h.split(".");
            2==a.length&&(b=b[a[0]],h=a[1]);
            b[h]=function(){b.push([h].concat(Array.prototype.slice.call(arguments,0)))}
          }
          var c=b;
          if(typeof d!=="undefined")c=b[d]=[];
          else d="mixpanel";
          c.people=c.people||[];
          c.toString=function(b: any){
            var a="mixpanel";
            if("mixpanel"!==d)a+="."+d;
            if(!b)a+=" (stub)";
            return a
          };
          c.people.toString=function(){return c.people.toString()};
          var o="disable time_event track track_pageview track_links track_forms register register_once alias unregister identify name_tag set_config reset people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");
          for(g=0;g<o.length;g++)f(c,o[g]);
          b._i.push([a,e,d])
        };
        b.__SV=1.2;
        a=f.createElement("script");
        a.type="text/javascript";
        a.async=true;
        a.src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
        e=f.getElementsByTagName("script")[0];
        e.parentNode!.insertBefore(a,e);
      }
    })(document, window.mixpanel||[]);
    
    window.mixpanel.init(MIXPANEL_TOKEN, { batch_requests: true });
    window.mixpanel.track_pageview();
  }
}

export function trackPageView(url: string) {
  if (typeof window === 'undefined') return;
  if (GA_ID && window.gtag) {
    window.gtag('config', GA_ID, { page_path: url });
  }
  if (MIXPANEL_TOKEN && window.mixpanel) {
    window.mixpanel.track_pageview(url);
  }
}

export function trackEvent(name: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  if (GA_ID && window.gtag) {
    window.gtag('event', name, properties);
  }
  if (MIXPANEL_TOKEN && window.mixpanel) {
    window.mixpanel.track(name, properties);
  }
}
