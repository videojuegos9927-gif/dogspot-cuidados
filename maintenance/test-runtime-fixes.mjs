// Offline regression checks. No email, database write, or browser session is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareSavedState, verifyCredential, emailTemplateId, emailFailureReason, storedQueue} from '../dogspot-runtime.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const name = html.match(/src="\.\/(index-runtime-[a-f0-9]+\.js)"/)[1];
const source = readFileSync(new URL(name, root), 'utf8');
const original = readFileSync(new URL('index-copy-e2117d823cf8.js', root), 'utf8');
const slice = (start, end, text = source) => {
  const first = text.indexOf(start, 200000), last = text.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application section: ${start}`);
  return text.slice(first, last);
};
const checks = [];
async function check(name, run) {await run(); checks.push(name); console.log('PASS', name);}

// Use the existing registration algorithm so login cannot drift away from it.
const cryptoContext = vm.createContext({Uint8Array, TextEncoder, window: {crypto: webcrypto}});
vm.runInContext(slice('var Ke=', 'var A='), cryptoContext);
const credential = await vm.runInContext('Ye("Mascota123")', cryptoContext);
await check('stored registration hash accepts only the correct password', async () => {
  assert.equal(await verifyCredential('Mascota123', credential, webcrypto), true);
  assert.equal(await verifyCredential('incorrecta', credential, webcrypto), false);
  assert.equal(await verifyCredential('Mascota123', {...credential, iterations: 1}, webcrypto), false);
  assert.equal(await verifyCredential('Mascota123', null, webcrypto), false);
});

const aliases = {DogSpotPrepareSavedState: prepareSavedState, DogSpotVerifyCredential: verifyCredential, DogSpotEmailTemplateId: emailTemplateId, DogSpotEmailFailureReason: emailFailureReason, DogSpotStoredQueue: storedQueue};
const common = {crypto: webcrypto, Uint8Array, TextEncoder, URL, AbortController, Intl, setTimeout, clearTimeout, ...aliases};
const restoreContext = vm.createContext({...common, f: [], m: array => array, Ot: () => [{id: 'meds', label: 'Medicamento', status: 'pendiente'}, {id: 'water', label: 'Agua', status: 'pendiente'}]});
vm.runInContext(slice('function Ve(', 'var He='), restoreContext);
const restoration = 'var ' + slice('kt={id:`luna`', 'var Nt=');
vm.runInContext(restoration, restoreContext);
const restore = value => {restoreContext.saved = value; return vm.runInContext('Mt(saved)', restoreContext);};
await check('legacy and malformed state restores without discarding valid records', () => {
  const state = restore({user: {id: 'customer', name: 'Cliente', email: 'cliente@example.org'}, pets: [null, {id: 'older-pet', name: 'Luna'}], active: null, tasks: [null], bookings: [null, {id: 'booking-1', petId: 'older-pet'}], notifications: null, serviceSnapshots: {'booking-1': {tasks: null, active: null}}, messages: [null, {from: 'ana', text: 'Conservado'}], authCredential: credential});
  assert.equal(state.pets.length, 1);
  assert.equal(state.pets[0].name, 'Luna');
  assert.equal(state.pets[0].meds, '');
  assert.equal(state.bookings[0].id, 'booking-1');
  assert.equal(state.messages[0].text, 'Conservado');
  assert.equal(state.messages[0].from, 'caregiver');
  assert.equal(state.authCredential.derived, credential.derived);
  assert.equal(state.user.id, 'customer');
  assert.equal(state.screen, 'splash');
  assert.doesNotThrow(() => restore(null));
  assert.doesNotThrow(() => restore({pets: [], active: null, serviceSnapshots: null}));
});

const user = {id: 'customer-1', name: 'Cliente', email: 'cliente@example.org', phone: '000000000'};
async function clickLogin(email, password, account = user, savedCredential = credential) {
  const values = [email, password, false, '', false];
  let index = 0, patch = null, error = '';
  const context = vm.createContext({...common, wt: 'usuario@dogspot.pe', Tt: 'dogspot123', mi: '', Oe: value => value.trim().toLowerCase(),
    ui: 'ui', V: 'field', z: 'button', R: () => '', un: 'visible', dn: 'hidden',
    l: {useState: initial => {const position = index++; return [values[position] ?? initial, value => {values[position] = value; if (position === 3) error = value;}];}},
    j: {jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props})},
    M: () => ({user: account, authCredential: savedCredential, set: value => {patch = value;}, go() {}}),
    St: () => ({recordActivity() {}})
  });
  const component = slice('function Ea({open:e})', 'function Da()');
  vm.runInContext(component, context);
  const tree = vm.runInContext('Ea({open(){}})', context);
  const find = node => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'button' && node.props.children === 'Iniciar sesión') return node;
    for (const child of [node.props?.children].flat()) {const result = find(child); if (result) return result;}
  };
  await find(tree).props.onClick();
  return {patch, error};
}
await check('login rejects an arbitrary password for the saved email', async () => {
  const result = await clickLogin('cliente@example.org', 'incorrecta');
  assert.equal(result.patch, null);
  assert.match(result.error, /incorrectos/);
});
await check('login accepts the correct password with normalized email', async () => {
  const result = await clickLogin('  CLIENTE@EXAMPLE.ORG ', 'Mascota123');
  assert.equal(result.patch.screen, 'home');
  assert.equal(result.patch.user.id, user.id);
});
await check('example credentials do not open a registered local profile', async () => {
  assert.equal((await clickLogin('usuario@dogspot.pe', 'dogspot123')).patch, null);
  assert.equal((await clickLogin('usuario@dogspot.pe', 'dogspot123', null, null)).patch.screen, 'home');
});
await check('old accounts without a verifiable password receive recovery guidance', async () => {
  const result = await clickLogin('cliente@example.org', 'cualquiera', user, null);
  assert.equal(result.patch, null);
  assert.match(result.error, /registro anterior/);
});

function provider(initial) {
  let state = initial, count = 0, registration = null;
  const context = vm.createContext({...common, At: initial, kt: {}, f: [], d: [], jt: 'state', Pt: {Provider: 'Provider'},
    l: {useState: () => count++ === 0 ? [state, change => {state = typeof change === 'function' ? change(state) : change;}] : [false, () => {}], useRef: value => ({current: value}), useEffect() {}},
    j: {jsx: (type, props) => props.value},
    Oe: value => value.trim().toLowerCase(), Ae: () => null, Be: async () => ({status: 'unavailable'}),
    St: () => ({recordRegistration: (...args) => {registration = args;}, recordBooking() {}}),
    Ot: () => [{id: 'meds', status: 'pendiente'}, {id: 'water', status: 'pendiente'}], Lt: () => '09:00'
  });
  vm.runInContext(slice('function Ft({children:e})', 'function M()'), context);
  return {api: vm.runInContext('Ft({children:null})', context), state: () => state, registration: () => registration};
}
const defaults = {user, authCredential: null, pets: [{id: 'pet-b', name: 'Mascota B', meds: ''}], selectedPetId: 'removed-a', bookings: [{id: 'booking-a', petId: 'removed-a', caregiverId: 'ana', status: 'finalizado', petSnapshot: {id: 'removed-a', name: 'Mascota A', meds: ''}}], currentBookingId: 'booking-a', serviceSnapshots: {}, reviews: [], emailReceipts: [], notifications: [], tasks: [], messages: [], active: {status: 'finalizado', rated: false}};
await check('registering an older local email preserves its identity and saves only its hash', () => {
  const p = provider(defaults);
  p.api.registerUser({name: 'Nombre actualizado', email: ' CLIENTE@EXAMPLE.ORG ', phone: '000000000'}, credential);
  assert.equal(p.state().user.id, user.id);
  assert.equal(p.state().authCredential.derived, credential.derived);
  assert.equal(p.registration()[2].derived, credential.derived);
  assert.equal(JSON.stringify(p.state()).includes('Mascota123'), false);
});
await check('historical services keep their own pet after its profile was deleted', () => {
  const p = provider(defaults);
  assert.equal(p.api.pet.name, 'Mascota A');
  p.api.openBooking('booking-a', 'summary');
  assert.equal(p.state().tasks.some(task => task.id === 'meds'), false);
});

await check('queued records survive config fetch failure followed by a new event', async () => {
  const context = vm.createContext({...common, pt: 'pending', mt: 'channel', ht: 500, gt: 30000, vt: () => true,
    yt: (event, origin) => event?.origin === origin ? event : null});
  const classSource = slice('var bt=class', ',xt;function St()');
  vm.runInContext(classSource + ';', context);
  let stored = JSON.stringify([{id: 'old-event', origin: 'https://dogspot.example', type: 'booking', data: {}}]);
  const host = {crypto: webcrypto, location: {origin: 'https://dogspot.example', href: 'https://dogspot.example/'}, innerWidth: 390, addEventListener() {}, localStorage: {getItem: () => stored, setItem: (key, value) => {stored = value;}}, fetch: async () => {throw Error('offline');}};
  context.host = host;
  const bridge = vm.runInContext('new bt(host,{})', context);
  bridge.flush = () => Promise.resolve();
  await bridge.enqueue('activity', {}, 'new-event');
  assert.deepEqual(JSON.parse(stored).map(event => event.id), ['old-event', 'new-event']);
  const inaccessibleStorage = {...host, get localStorage() {throw Error('blocked');}};
  context.host = inaccessibleStorage;
  assert.doesNotThrow(() => vm.runInContext('new bt(host,{})', context));
});
await check('completion emails use their configured template and retain compatibility', () => {
  const config = {welcomeTemplateId: 'welcome', bookingTemplateId: 'booking', completionTemplateId: 'completion'};
  assert.equal(emailTemplateId(config, 'completion'), 'completion');
  assert.equal(emailTemplateId({...config, completionTemplateId: undefined}, 'completion'), 'booking');
  assert.equal(emailTemplateId(config, 'booking'), 'booking');
  assert.equal(emailFailureReason(400, 'The Public Key is invalid'), 'public-key');
  assert.equal(emailFailureReason(404, 'The service ID does not exist'), 'missing-service');
  assert.equal(emailFailureReason(404, 'The template ID not found'), 'missing-template');
  assert.equal(emailFailureReason(401, 'Gmail authentication failed'), 'authorization');
});
await check('existing integration settings and protected service control are retained', () => {
  assert.equal(readFileSync(new URL('email-config.json', root), 'utf8').includes('dogspot.peru@gmail.com'), true);
  for (const marker of ['Demo: iniciar cuidado y seguimiento', 'function DogSpotCompletionReceipt(', 'dogspot-state-v1', 'dogspot-sheets-pending-v1']) assert.ok(source.includes(marker));
  assert.equal(original.includes('r&&i===r.email'), true);
  assert.equal(source.includes('r&&i===r.email'), false);
});
console.log(`${checks.length} offline regression checks passed for ${name}.`);
