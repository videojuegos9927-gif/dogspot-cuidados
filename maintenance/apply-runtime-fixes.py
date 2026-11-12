"""Apply guarded changes to the recovered published build; keep the original bundle."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'index-copy-e2117d823cf8.js'
js = (ROOT / SOURCE).read_text(encoding='utf-8')

def replace(old, new):
    global js
    assert js.count(old) == 1, f'Expected exactly one match: {old[:100]}'
    js = js.replace(old, new)

helper_digest = hashlib.sha256((ROOT / 'dogspot-runtime.mjs').read_bytes()).hexdigest()[:12]
js = 'import {prepareSavedState as DogSpotPrepareSavedState,verifyCredential as DogSpotVerifyCredential,emailTemplateId as DogSpotEmailTemplateId,emailFailureReason as DogSpotEmailFailureReason,storedQueue as DogSpotStoredQueue} from "./dogspot-runtime.mjs?v=' + helper_digest + '";\n' + js
replace('function Mt(e){let t={...At,...e};', 'function Mt(e){e=DogSpotPrepareSavedState(e,At);let t={...At,...e};')
replace('user:null,emailReceipts:[]', 'user:null,authCredential:null,emailReceipts:[]')
replace('let{set:t,go:n,user:r}=M()', 'let{set:t,go:n,user:r,authCredential:credential}=M()')
replace('Acceso de prueba. Puedes usar los datos de ejemplo o explorar sin crear una cuenta.', 'El acceso y la contraseña se guardan en este navegador. También puedes explorar sin crear una cuenta.')
replace('onClick:()=>{if(!i.trim()||!o.trim())return f(`Completa los datos para continuar`);let e=i===`usuario@dogspot.pe`&&o===`dogspot123`||r&&i===r.email;if(St().recordActivity(`inicio_sesion`,{correoIngresado:i.trim().toLowerCase(),resultado:e?`Acceso de demostración`:`No coincide con el registro local`},{user:r,screen:`login`}),!e)return f(`Correo o contraseña incorrectos. Usa los datos de ejemplo.`);f(``),m(!0),setTimeout(()=>{t({user:r??{name:`Jefferson`,email:`usuario@dogspot.pe`,phone:`987 654 321`},screen:`home`})},700)}', '''onClick:async()=>{
if(p)return;
if(!i.trim()||!o.trim())return f(`Completa los datos para continuar`);
const email=Oe(i),localAccount=!!r&&Oe(r.email)!==wt;
if(localAccount&&email===Oe(r.email)&&!credential)return f(`Este registro anterior no tiene una contraseña verificable en este navegador. Puedes explorar la app o volver a registrar este mismo correo para establecerla.`);
m(!0);f(``);
try{
const accepted=localAccount?email===Oe(r.email)&&await DogSpotVerifyCredential(o,credential):email===wt&&o===Tt;
St().recordActivity(`inicio_sesion`,{correoIngresado:email,resultado:accepted?`Acceso local`:`Correo o contraseña incorrectos`},{user:r,screen:`login`});
if(!accepted)return f(`Correo o contraseña incorrectos. Revisa tus datos.`);
t({user:r??{name:`Jefferson`,email:wt,phone:`987 654 321`},screen:`home`});
}catch{f(`No se pudo comprobar la contraseña. Vuelve a intentarlo desde el enlace HTTPS de DogSpot.`)}finally{m(!1)}
}''')
# Keep the saved identity/profile when an older local account is registered again.
replace('g=(e,t)=>{let r={...e,id:crypto.randomUUID(),updatedAt:', 'g=(e,credential)=>{let r={...((t.user&&Oe(t.user.email)===Oe(e.email))?t.user:{}),...e,id:t.user&&Oe(t.user.email)===Oe(e.email)?t.user.id??crypto.randomUUID():crypto.randomUUID(),updatedAt:')
replace('n(e=>({...e,user:r,emailReceipts:i?', 'n(e=>({...e,user:r,authCredential:credential,emailReceipts:i?')
replace('St().recordRegistration(r,i?.id??crypto.randomUUID(),t)', 'St().recordRegistration(r,i?.id??crypto.randomUUID(),credential)')
replace('S=t.pets.find(e=>e.id===t.selectedPetId)??t.pets[0]??t.bookings.find(e=>e.id===t.currentBookingId)?.petSnapshot', 'S=t.pets.find(e=>e.id===t.selectedPetId)??t.bookings.find(e=>e.id===t.currentBookingId)?.petSnapshot??t.pets[0]')
replace('tasks:a?.tasks??Ot(),messages:a?.messages', 'tasks:a?.tasks??Ot().filter(task=>task.id!==`meds`||!!(r.petSnapshot??n.pets.find(pet=>pet.id===r.petId))?.meds?.trim()&&(r.petSnapshot??n.pets.find(pet=>pet.id===r.petId)).meds.trim().toLowerCase()!==`no aplica`),messages:a?.messages')
replace('this.visitId=this.id(),this.host.addEventListener', 'this.visitId=this.id(),this.queue=DogSpotStoredQueue(()=>this.host.localStorage,pt,yt,this.host.location.origin),this.host.addEventListener')
replace('template_id:e.kind===`welcome`?n.welcomeTemplateId:n.bookingTemplateId', 'template_id:DogSpotEmailTemplateId(n,e.kind)')
replace('reason:t.status===429?`quota`:t.status===401||t.status===403?`authorization`:t.status===404?`missing-template`:t.status===422?`recipient`:t.status===400?`configuration`:t.status>=500?`provider`:`rejected`', 'reason:DogSpotEmailFailureReason(t.status,await t.text().catch(()=>``))')
replace('if(t.enabled!==!0||![`serviceId`', 'if(t.completionTemplateId!=null&&(typeof t.completionTemplateId!==`string`||!/^[A-Za-z0-9_-]{3,160}$/.test(t.completionTemplateId)))return!1;if(t.enabled!==!0||![`serviceId`')
replace('e.reason===`missing-template`?`EmailJS no reconoce', 'e.reason===`public-key`?`No pudimos enviar el correo. El equipo de DogSpot debe revisar la clave pública de EmailJS.`:e.reason===`missing-service`?`No pudimos enviar el correo. El equipo de DogSpot debe revisar el servicio de correo conectado.`:e.reason===`missing-template`?`EmailJS no reconoce')
replace('email:r.email.trim(),address:r.address.trim()', 'email:Oe(r.email),address:r.address.trim()')

digest = hashlib.sha256(js.encode()).hexdigest()[:12]
name = f'index-runtime-{digest}.js'
(ROOT / name).write_text(js, encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')
import re
index, count = re.subn(r'(?<=src="\./)index-(?:copy|runtime)-[^"/]+\.js', name, index)
assert count == 1
(ROOT / 'index.html').write_text(index, encoding='utf-8')
print(name)
