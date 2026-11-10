"""Browser regression checks with fictional local fixtures and all external traffic blocked."""
import functools, json, re, shutil, sys, threading, traceback
from datetime import date, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(sys.argv[1]).resolve()
OUT = ROOT / '.recovery-results'
OUT.mkdir(exist_ok=True)
CTA = 'Demo: iniciar cuidado y seguimiento'
SCREENS = ['splash','login','register','registration-confirmation','pet','pets','home','hire','caregivers','payment','confirm','active','tracking','caregiver-tasks','notifications','assistant','messages','summary','services','profile','edit-profile','email-history']
STORE = """() => {
 const el=document.getElementById('root');
 const key=Object.keys(el).find(k=>k.startsWith('__reactContainer$'));
 if(!key) return null;
 let root=el[key]; root=root?.stateNode?.current || root;
 const stack=[root]; const seen=new Set();
 while(stack.length){const f=stack.pop();if(!f||seen.has(f))continue;seen.add(f);
  const v=f.memoizedProps?.value;
  if(v&&typeof v.go==='function'&&typeof v.set==='function'&&Array.isArray(v.pets))return v;
  if(f.child)stack.push(f.child);if(f.sibling)stack.push(f.sibling);
 }return null;
}"""
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'passed':False,'screens':[],'errors':[],'external_requests_sent':0}
try:
 with sync_playwright() as p:
  executable=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
  browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for label,width,height in [('mobile',390,844),('desktop',1366,900)]:
   context=browser.new_context(viewport={'width':width,'height':height})
   page=context.new_page(); page.set_default_timeout(15000)
   errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   def route(r):
    u=urlsplit(r.request.url)
    if u.path.endswith(('email-config.json','sheets-config.json')):
     r.fulfill(status=200,content_type='application/json',body='{"enabled":false}')
    elif u.hostname=='127.0.0.1':r.continue_()
    else:r.abort()
   page.route('**/*',route)
   page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
   page.evaluate('window.__getTestStore = '+STORE)
   page.wait_for_function('window.__getTestStore()?.ready')
   page.get_by_role('button',name='Explorar la app',exact=True).click()
   page.wait_for_function("window.__getTestStore()?.screen==='home'")
   day=(date.today()+timedelta(days=2)).isoformat()
   page.evaluate("""day=>{
    const v=window.__getTestStore();const pet={...v.pets[0],name:'Luna QA'};
    const session={date:day,start:'09:00',end:'13:00',hours:4};
    const booking={id:'qa-reserva',mode:'horas',petId:pet.id,caregiverId:'ana',date:day,start:'09:00',end:'13:00',hours:4,total:140,sessions:[session],status:'confirmado',payment:'Yape',petSnapshot:{...pet},care:'',notes:'',medTime:''};
    v.set({user:{id:'qa-usuario',name:'Prueba conservacion',email:'qa@example.org',phone:'000000000'},pets:[pet],selectedPetId:pet.id,bookings:[booking],currentBookingId:booking.id,active:{status:'confirmado',rated:false},draft:{...booking},messages:[{id:'qa-mensaje',from:'owner',text:'Mensaje conservado de prueba',time:'09:00'}]});
   }""",day)
   page.wait_for_timeout(300)
   before=page.evaluate("JSON.parse(localStorage.getItem('dogspot-state-v1'))")
   page.reload(wait_until='networkidle')
   page.evaluate('window.__getTestStore = '+STORE)
   page.wait_for_function('window.__getTestStore()?.ready')
   after=page.evaluate("JSON.parse(localStorage.getItem('dogspot-state-v1'))")
   for key in ['user','pets','bookings','messages','selectedPetId','currentBookingId']:
    assert before[key]==after[key],f'Persistence mismatch: {key}'
   assert page.evaluate('window.__getTestStore().screen')=='splash'
   for screen in SCREENS:
    page.evaluate('screen=>window.__getTestStore().go(screen)',screen)
    page.wait_for_timeout(200)
    text=page.locator('body').inner_text()
    unexpected=re.findall(r'\bdemo\b|\bdemostraci[oó]n\b',text.replace(CTA,''),flags=re.I)
    assert not unexpected,f'Unexpected demo label on {label}/{screen}: {text}'
    assert not errors,f'JavaScript errors: {errors}'
    report['screens'].append({'viewport':label,'screen':screen,'passed':True})
    if screen in ['splash','home','caregivers','payment','active','messages','profile']:
     page.screenshot(path=str(OUT/f'{label}-{screen}.png'),full_page=True)
   page.evaluate("window.__getTestStore().set({screen:'active',active:{status:'confirmado',rated:false}})")
   page.get_by_role('button',name=CTA,exact=True).click()
   page.wait_for_function("window.__getTestStore().active.status==='activo'")
   assert page.get_by_role('button',name='Simular fin del servicio',exact=True).is_visible()
   page.get_by_role('button',name='Ver seguimiento',exact=False).click()
   page.wait_for_function("window.__getTestStore().screen==='tracking'")
   report[label]={'persistence':True,'protected_cta_works':True,'tracking_navigation':True,'js_errors':errors}
   context.close()
  browser.close()
 report['passed']=True
except Exception:
 report['errors'].append(traceback.format_exc())
 raise
finally:
 (OUT/'ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))
 server.shutdown()
