# Reglas recomendadas para historias originales

Estas reglas son una guia para cuando se actualice Firestore. No estan aplicadas
todavia desde el proyecto.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userEmail() {
      return request.auth.token.email != null
        ? request.auth.token.email.lower()
        : "";
    }

    function collaborators() {
      return resource.data.colaboradoresPermitidos is list
        ? resource.data.colaboradoresPermitidos
        : [];
    }

    function isStoryAuthor() {
      return signedIn() && resource.data.autorId == request.auth.uid;
    }

    function canManageStory() {
      return isStoryAuthor()
        || collaborators().hasAny([request.auth.uid, userEmail()]);
    }

    match /historias/{historiaId} {
      allow read: if true;

      allow create: if signedIn()
        && request.resource.data.tipo in ["original", "traduccion"]
        && request.resource.data.autorId == request.auth.uid
        && request.resource.data.slug is string
        && request.resource.data.colaboradoresPermitidos is list;

      allow update: if signedIn()
        && (
          canManageStory()
          || request.resource.data.diff(resource.data).changedKeys()
            .hasOnly(["likes", "comentarios"])
        );

      match /capitulos/{capituloId} {
        allow read: if true;

        allow create: if signedIn()
          && (
            get(/databases/$(database)/documents/historias/$(historiaId)).data.tipo == "traduccion"
            || get(/databases/$(database)/documents/historias/$(historiaId)).data.autorId == request.auth.uid
            || get(/databases/$(database)/documents/historias/$(historiaId)).data.colaboradoresPermitidos.hasAny([
              request.auth.uid,
              userEmail()
            ])
          );

        allow update, delete: if signedIn()
          && (
            get(/databases/$(database)/documents/historias/$(historiaId)).data.autorId == request.auth.uid
            || get(/databases/$(database)/documents/historias/$(historiaId)).data.colaboradoresPermitidos.hasAny([
              request.auth.uid,
              userEmail()
            ])
            || resource.data.traductorId == request.auth.uid
          );
      }
    }
  }
}
```

Notas importantes:
- Firestore Rules no garantizan unicidad global de `slug` si el cliente solo
  consulta `where("slug", "==", slug)`. Para blindarlo, usar el `slug` como ID
  del documento o crear una coleccion `slugs/{slug}` reservada en una Cloud
  Function o transaccion.
- Conviene normalizar emails a minusculas en el cliente. Los UID se guardan
  exactos porque pueden ser sensibles a mayusculas.
- Para separar likes/comentarios de permisos editoriales, lo ideal en una etapa
  futura es moverlos a subcolecciones propias o usar operaciones `arrayUnion`.
- Las traducciones quedan creadas con `estado: "pendiente"`. En una etapa de
  moderacion se puede restringir quien cambia `estado` a `aprobada` o
  `rechazada`.
