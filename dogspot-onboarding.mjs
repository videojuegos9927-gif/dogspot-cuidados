const accountEmail = user => typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
const personalAccount = user => !!accountEmail(user) && accountEmail(user) !== 'usuario@dogspot.pe';

// Remove only the untouched built-in reference. A registered pet named Luna,
// an edited reference or a pet with a booking must always be preserved.
export function withoutReferencePet(pets, reference, bookings = []) {
  return (Array.isArray(pets) ? pets : []).filter(pet => {
    if (!pet || !reference || pet.id !== reference.id || bookings.some(booking => booking.petId === pet.id)) return true;
    const keys = Object.keys(pet);
    return keys.length !== Object.keys(reference).length || keys.some(key => pet[key] !== reference[key]);
  });
}

export function registrationState(current, user, reference) {
  const sameAccount = personalAccount(current.user) && accountEmail(current.user) === accountEmail(user);
  if (personalAccount(current.user) && !sameAccount) {
    throw new Error('Este navegador ya tiene un perfil con otro correo. Inicia sesión con ese correo o actualízalo desde Mi perfil.');
  }
  const pets = sameAccount ? withoutReferencePet(current.pets, reference, current.bookings) : [];
  if (sameAccount) return {pets, selectedPetId: pets.some(pet => pet.id === current.selectedPetId) ? current.selectedPetId : pets[0]?.id ?? ''};
  return {pets: [], selectedPetId: '', editingPetId: null, returnTo: 'home', bookings: [], currentBookingId: null,
    serviceSnapshots: {}, draft: null, tasks: [], messages: [], notifications: [], active: {status: 'confirmado', rated: false}};
}

export function migrateRegisteredPets(state, reference) {
  if (!personalAccount(state.user) || !Array.isArray(state.pets)) return state;
  const pets = withoutReferencePet(state.pets, reference, state.bookings);
  if (pets.length === state.pets.length) return state;
  return {...state, pets, selectedPetId: pets.some(pet => pet.id === state.selectedPetId) ? state.selectedPetId : pets[0]?.id ?? ''};
}
