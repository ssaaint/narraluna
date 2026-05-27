export const getFriendlyFirebaseError = (error) => {
  const code = error?.code || "";

  if (code.includes("permission-denied")) {
    return "No tenes permisos para realizar esta accion.";
  }

  if (code.includes("unauthenticated")) {
    return "Tenes que iniciar sesion para hacer esto.";
  }

  if (code.includes("not-found")) {
    return "No encontramos esta obra.";
  }

  if (code.includes("unavailable")) {
    return "Hay un problema temporal con el servidor. Intenta de nuevo.";
  }

  return "Ocurrio un error. Intenta de nuevo.";
};

export const alertFriendlyFirebaseError = (error, fallback) => {
  console.error("Error completo:", error);
  alert(fallback || getFriendlyFirebaseError(error));
};
