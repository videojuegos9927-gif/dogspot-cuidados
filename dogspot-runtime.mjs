// Runtime fixes for the published DogSpot build. No private credentials belong here.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const records = value => Array.isArray(value) ? value.filter(object) : [];
const statuses = new Set(['confirmado', 'activo', 'finalizado']);
const petStrings = ['name', 'species', 'breed', 'age', 'weight', 'feeding', 'health', 'meds', 'care', 'notes'];

function normalizePet(pet) {
  const result = {...pet};
  for (const key of petStrings) result[key] = typeof pet[key] === 'string' ? pet[key] : '';
  return result;
}

function normalizeService(value, defaults) {
  const result = {...value};
  for (const key of ['tasks', 'messages', 'notifications']) result[key] = records(value[key]);
  result.active = {...defaults.active, ...(object(value.active) ? value.active : {})};
  if (!statuses.has(result.active.status)) result.active.status = defaults.active.status;
  return result;
}

export function prepareSavedState(value, defaults) {
  const saved = object(value) ? value : {};
  const result = {...saved, ...normalizeService(saved, defaults)};
  result.user = object(saved.user) && typeof saved.user.email === 'string' && typeof saved.user.name === 'string' ? {...saved.user, phone: typeof saved.user.phone === 'string' ? saved.user.phone : ''} : null;
  if (Array.isArray(saved.pets)) result.pets = records(saved.pets).filter(pet => typeof pet.id === 'string' && pet.id).map(normalizePet);
  else if (object(saved.pet)) result.pet = normalizePet(saved.pet);
  result.bookings = records(saved.bookings).filter(booking => typeof booking.id === 'string' && booking.id).map(booking => ({...booking, ...(object(booking.petSnapshot) ? {petSnapshot: normalizePet(booking.petSnapshot)} : {})}));
  result.reviews = Array.isArray(saved.reviews) ? records(saved.reviews) : defaults.reviews;
  result.serviceSnapshots = Object.fromEntries(Object.entries(object(saved.serviceSnapshots) ? saved.serviceSnapshots : {}).filter(([, service]) => object(service)).map(([id, service]) => [id, normalizeService(service, defaults)]));
  result.authCredential = validCredential(saved.authCredential) ? saved.authCredential : null;
  return result;
}

export function validCredential(value) {
  return !!(object(value) && value.scheme === 'PBKDF2-SHA256' && value.iterations === 600000 && /^[a-f0-9]{64}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.derived));
}

export async function verifyCredential(password, credential, crypto = globalThis.crypto) {
  if (!validCredential(credential) || typeof password !== 'string' || password.length < 6 || password.length > 256 || !crypto?.subtle) return false;
  const bytes = new TextEncoder().encode(password);
  try {
    const salt = Uint8Array.from(credential.salt.match(/../g), pair => Number.parseInt(pair, 16));
    const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', iterations: credential.iterations, salt}, key, 256));
    const expected = Uint8Array.from(credential.derived.match(/../g), pair => Number.parseInt(pair, 16));
    return derived.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0) === 0;
  } finally {
    bytes.fill(0);
  }
}

export function emailTemplateId(config, kind) {
  return kind === 'welcome' ? config.welcomeTemplateId : kind === 'completion' ? config.completionTemplateId || config.bookingTemplateId : config.bookingTemplateId;
}

export function emailFailureReason(status, body = '') {
  const message = String(body).slice(0, 1000).toLowerCase();
  if (status === 429) return 'quota';
  if (/public.?key|user.?id|account.*not found/.test(message)) return 'public-key';
  if (/template.*(not found|invalid|does not exist)/.test(message)) return 'missing-template';
  if (/service.*(not found|invalid|does not exist)/.test(message)) return 'missing-service';
  if (/oauth|gmail|authentication|re.?connect|invalid_grant/.test(message) || status === 401 || status === 403) return 'authorization';
  if (status === 404) return 'missing-template';
  if (status === 422) return 'recipient';
  if (status === 400) return 'configuration';
  return status >= 500 ? 'provider' : 'rejected';
}

export function storedQueue(storage, key, restore, origin) {
  try {
    const store = typeof storage === 'function' ? storage() : storage;
    const value = JSON.parse(store.getItem(key) || '[]');
    return Array.isArray(value) ? value.map(event => {try {return restore(event, origin);} catch {return null;}}).filter(Boolean).slice(-500) : [];
  } catch {return [];}
}
