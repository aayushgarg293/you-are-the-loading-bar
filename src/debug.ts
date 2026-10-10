// Reads test switches from the page address, e.g. ?scene=hamster&energy=70.
const params = new URLSearchParams(window.location.search);

export const debugText = (name: string) => params.get(name);

export const debugNumber = (name: string) => {
  const value = params.get(name);
  return value === null ? null : Number(value);
};
