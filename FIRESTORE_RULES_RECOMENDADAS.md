# Firestore Rules recomendadas

Estas reglas son una guia para aplicar manualmente en Firebase. No se aplican
desde el proyecto. Estan pensadas para la estructura actual de Umbral de
Historias: obras, capitulos, traducciones, comentarios, likes, seguidores,
progreso de lectura y notificaciones.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userDoc(uid) {
      return get(/databases/$(database)/documents/usuarios/$(uid));
    }

    function isAdmin() {
      return signedIn()
        && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))
        && userDoc(request.auth.uid).data.rol == "admin";
    }

    function userEmail() {
      return signedIn() && request.auth.token.email != null
        ? request.auth.token.email.lower()
        : "";
    }

    function listOrEmpty(value) {
      return value is list ? value : [];
    }

    function obraRef(obraId) {
      return /databases/$(database)/documents/obras/$(obraId);
    }

    function obraData(obraId) {
      return get(obraRef(obraId)).data;
    }

    function obraCollaborators(obraId) {
      return listOrEmpty(obraData(obraId).colaboradoresPermitidos);
    }

    function obraTranslators(obraId) {
      return listOrEmpty(obraData(obraId).traductoresAutorizados);
    }

    function isObraOwner(obraId) {
      return signedIn()
        && (
          obraData(obraId).autorId == request.auth.uid
          || obraData(obraId).creadoPor == request.auth.uid
        );
    }

    function canManageObra(obraId) {
      return signedIn()
        && (
          isAdmin()
          || isObraOwner(obraId)
          || obraCollaborators(obraId).hasAny([request.auth.uid, userEmail()])
        );
    }

    function canManageObraPermissions(obraId) {
      return signedIn() && (isAdmin() || isObraOwner(obraId));
    }

    function canTranslateObra(obraId) {
      return signedIn()
        && (
          isAdmin()
          || (obraAllowsTranslations(obraId) && isObraOwner(obraId))
          || userDoc(request.auth.uid).data.capitulosLeidos >= 100
          || userDoc(request.auth.uid).data.puedeTraducir == true
          || obraTranslators(obraId).hasAny([request.auth.uid, userEmail()])
        );
    }

    function obraAllowsTranslations(obraId) {
      return obraData(obraId).tipo == "obra_externa"
        || obraData(obraId).permiteTraducciones == true
        || obraData(obraId).estadoTraducible == true;
    }

    match /usuarios/{uid} {
      allow read: if true;
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if signedIn()
        && (
          request.auth.uid == uid
          || isAdmin()
        )
        && (
          isAdmin()
          || !request.resource.data.diff(resource.data).changedKeys()
            .hasAny(["rol"])
        );
      allow delete: if isAdmin();

      match /progreso/{obraId} {
        allow read, write: if signedIn() && request.auth.uid == uid;
      }

      match /seguidas/{obraId} {
        allow read, write, delete: if signedIn() && request.auth.uid == uid;
      }

      match /capitulosLeidos/{readId} {
        allow read, create, update: if signedIn() && request.auth.uid == uid;
        allow delete: if isAdmin();
      }

      match /notificaciones/{notificationId} {
        allow read, update, delete: if signedIn() && request.auth.uid == uid;
        allow create: if signedIn();
      }
    }

    match /obras/{obraId} {
      allow read: if resource.data.estado != "eliminada" || isAdmin();

      allow create: if signedIn()
        && request.resource.data.autorId == request.auth.uid
        && request.resource.data.creadoPor == request.auth.uid
        && request.resource.data.tipo in ["original", "obra_externa"]
        && (
          request.resource.data.tipo == "original"
          || isAdmin()
        )
        && request.resource.data.colaboradoresPermitidos is list
        && request.resource.data.traductoresAutorizados is list;

      allow update: if (
          canManageObra(obraId)
          && (
            canManageObraPermissions(obraId)
            || !request.resource.data.diff(resource.data).changedKeys().hasAny([
              "colaboradoresPermitidos",
              "colaboradores",
              "traductoresAutorizados",
              "traductoresPermitidos",
              "permiteTraducciones",
              "estadoTraducible"
            ])
          )
        )
        || (
          signedIn()
          && request.resource.data.diff(resource.data).changedKeys().hasOnly([
            "likesCount",
            "comentariosCount",
            "seguidoresCount",
            "estadisticas",
            "fechaActualizacion",
            "updatedAt"
          ])
        );

      allow delete: if isAdmin();

      match /capitulos/{capituloId} {
        allow read: if true;
        allow create: if canManageObra(obraId);
        allow update, delete: if canManageObra(obraId)
          || (signedIn() && resource.data.autorId == request.auth.uid)
          || (signedIn() && resource.data.creadoPor == request.auth.uid);

        match /likes/{uid} {
          allow read: if true;
          allow create, delete: if signedIn() && request.auth.uid == uid;
          allow update: if false;
        }

        match /comentarios/{comentarioId} {
          allow read: if true;
          allow create: if signedIn()
            && request.resource.data.autorId == request.auth.uid;
          allow update: if false;
          allow delete: if signedIn()
            && (
              resource.data.autorId == request.auth.uid
              || isAdmin()
            );
        }
      }

      match /traducciones/{traduccionId} {
        allow read: if true;
        allow create: if obraAllowsTranslations(obraId) && canTranslateObra(obraId);
        allow update: if canManageObraPermissions(obraId)
          || resource.data.traductorPrincipalId == request.auth.uid;
        allow delete: if isAdmin();

        match /capitulos/{capituloId} {
          allow read: if true;
          allow create: if obraAllowsTranslations(obraId) && canTranslateObra(obraId)
            && request.resource.data.estado == "pendiente";
          allow update: if isAdmin()
            || canManageObraPermissions(obraId)
            || resource.data.traductorId == request.auth.uid;
          allow delete: if isAdmin()
            || canManageObraPermissions(obraId)
            || resource.data.traductorId == request.auth.uid;

          match /likes/{uid} {
            allow read: if true;
            allow create, delete: if signedIn() && request.auth.uid == uid;
            allow update: if false;
          }
        }
      }

      match /comentarios/{comentarioId} {
        allow read: if true;
        allow create: if signedIn()
          && request.resource.data.autorId == request.auth.uid;
        allow update: if false;
        allow delete: if signedIn()
          && (
            resource.data.autorId == request.auth.uid
            || isAdmin()
          );
      }

      match /likes/{uid} {
        allow read: if true;
        allow create, delete: if signedIn() && request.auth.uid == uid;
        allow update: if false;
      }

      match /seguidores/{uid} {
        allow read: if true;
        allow create, delete: if signedIn() && request.auth.uid == uid;
        allow update: if false;
      }
    }

    // Compatibilidad temporal con la coleccion anterior.
    match /historias/{historiaId} {
      allow read: if true;
      allow create: if signedIn()
        && request.resource.data.autorId == request.auth.uid
        && request.resource.data.creadoPor == request.auth.uid;
      allow update: if signedIn()
        && (
          isAdmin()
          || resource.data.autorId == request.auth.uid
          || resource.data.creadoPor == request.auth.uid
          || listOrEmpty(resource.data.colaboradoresPermitidos)
            .hasAny([request.auth.uid, userEmail()])
        );
      allow delete: if isAdmin();

      match /capitulos/{capituloId} {
        allow read: if true;
        allow create, update, delete: if isAdmin()
          || get(/databases/$(database)/documents/historias/$(historiaId)).data.autorId == request.auth.uid
          || get(/databases/$(database)/documents/historias/$(historiaId)).data.creadoPor == request.auth.uid
          || listOrEmpty(get(/databases/$(database)/documents/historias/$(historiaId)).data.colaboradoresPermitidos)
            .hasAny([request.auth.uid, userEmail()]);
      }
    }
  }
}
```

Notas:
- El rol admin no se asigna desde la app. Se configura manualmente en
  `usuarios/{uid}.rol = "admin"`.
- El borrado desde la app usa soft delete (`estado: "eliminada"`), no elimina
  documentos fisicamente.
- Las reglas permiten crear likes/seguidores por UID propio para evitar
  duplicados por usuario.
- La unicidad global de `slug` sigue siendo responsabilidad del cliente en esta
  etapa; para blindarla conviene reservar slugs en una coleccion dedicada o en
  una Cloud Function.
