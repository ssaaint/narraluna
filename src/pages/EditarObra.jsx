import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  buildObraFromHistoria,
  OBRA_TYPE_EXTERNAL,
  OBRA_TYPE_ORIGINAL
} from "../utils/obraUtils";
import {
  listOrEmpty,
  safeFirestorePayload,
  textOrEmpty
} from "../utils/firestoreSafe";
import {
  normalizeCollaborators,
  userCanManageStory
} from "../utils/permissionUtils";

const listToInput = (value) =>
  Array.isArray(value) ? value.join(", ") : String(value || "");

const multilineToList = (value) => normalizeCollaborators(value);

const stripTransientFields = (data) => {
  const clean = { ...data };
  delete clean.id;
  delete clean.source;
  delete clean.route;
  delete clean.detailRoute;
  delete clean.tipoLegible;
  return clean;
};

export default function EditarObra() {
  const { obraId } = useParams();
  const navigate = useNavigate();

  const [obra, setObra] = useState(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [generos, setGeneros] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [portadaUrl, setPortadaUrl] = useState("");
  const [autorOriginal, setAutorOriginal] = useState("");
  const [idiomaOriginal, setIdiomaOriginal] = useState("");
  const [paisOrigen, setPaisOrigen] = useState("");
  const [permiteTraducciones, setPermiteTraducciones] = useState(false);
  const [colaboradores, setColaboradores] = useState("");
  const [traductoresAutorizados, setTraductoresAutorizados] = useState("");

  function hydrateForm(data) {
    setTitulo(data.titulo || "");
    setDescripcion(data.descripcion || "");
    setGeneros(listToInput(data.generos));
    setEtiquetas(listToInput(data.etiquetas));
    setPortadaUrl(data.portadaUrl || data.portada || "");
    setAutorOriginal(data.autorOriginal || "");
    setIdiomaOriginal(data.idiomaOriginal || "");
    setPaisOrigen(data.paisOrigen || "");
    setPermiteTraducciones(data.permiteTraducciones === true);
    setColaboradores((data.colaboradoresPermitidos || []).join("\n"));
    setTraductoresAutorizados((data.traductoresAutorizados || []).join("\n"));
  }

  useEffect(() => {
    const cargarObra = async () => {
      try {
        const obraSnap = await getDoc(doc(db, "obras", obraId));

        if (obraSnap.exists()) {
          const data = {
            id: obraSnap.id,
            source: "obras",
            ...obraSnap.data()
          };
          setObra(data);
          setSource("obras");
          hydrateForm(data);
          return;
        }

        const historiaSnap = await getDoc(doc(db, "historias", obraId));

        if (historiaSnap.exists()) {
          const data = buildObraFromHistoria({
            id: historiaSnap.id,
            ...historiaSnap.data()
          });
          setObra(data);
          setSource("historias");
          hydrateForm(data);
          return;
        }

        setObra(null);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (obraId) {
      cargarObra();
    }
  }, [obraId]);

  const puedeEditar = userCanManageStory(auth.currentUser, obra);
  const esObraExterna = obra?.tipo === OBRA_TYPE_EXTERNAL;

  const buildUpdatePayload = () => {
    const tituloFinal = textOrEmpty(titulo);

    if (!tituloFinal) {
      throw new Error("El titulo es obligatorio.");
    }

    const generosFinales = listOrEmpty(generos);
    const etiquetasFinales = listOrEmpty(etiquetas);
    const portadaFinal = textOrEmpty(portadaUrl);
    const now = new Date();
    const canTranslate = Boolean(permiteTraducciones);

    return safeFirestorePayload({
      titulo: tituloFinal,
      descripcion: textOrEmpty(descripcion),
      generos: generosFinales,
      etiquetas: etiquetasFinales,
      portada: portadaFinal,
      portadaUrl: portadaFinal,
      permiteTraducciones: canTranslate,
      estadoTraducible: canTranslate,
      colaboradoresPermitidos: multilineToList(colaboradores),
      traductoresAutorizados: multilineToList(traductoresAutorizados),
      autorOriginal: esObraExterna ? textOrEmpty(autorOriginal) : "",
      idiomaOriginal: esObraExterna ? textOrEmpty(idiomaOriginal) : "",
      paisOrigen: esObraExterna ? textOrEmpty(paisOrigen) : "",
      fechaActualizacion: now,
      updatedAt: now
    });
  };

  const guardarCambios = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!puedeEditar) {
      alert("No tenés permisos para editar esta historia.");
      return;
    }

    try {
      setSaving(true);
      const updatePayload = buildUpdatePayload();
      const ref = doc(db, source === "obras" ? "obras" : "historias", obraId);

      await updateDoc(ref, updatePayload);

      if (source === "historias") {
        try {
          await setDoc(
            doc(db, "obras", obraId),
            safeFirestorePayload({
              ...stripTransientFields(buildObraFromHistoria({
                ...obra,
                ...updatePayload,
                id: obraId
              })),
              ...updatePayload,
              tipo: obra.tipo || OBRA_TYPE_ORIGINAL,
              autorId: obra.autorId || obra.creadoPor || auth.currentUser.uid,
              creadoPor: obra.creadoPor || obra.autorId || auth.currentUser.uid,
              historiaLegacyId: obraId,
              legacySource: "historias"
            }),
            { merge: true }
          );
        } catch (mirrorError) {
          console.error("No se pudo reflejar la edicion legacy en obras:", mirrorError);
        }
      }

      alert("Historia actualizada");
      navigate(`/obra/${obraId}`);
    } catch (error) {
      console.error("Error completo al editar historia:", error);
      alert(error.message || "Error desconocido al editar");
    } finally {
      setSaving(false);
    }
  };

  const migrarAObra = async () => {
    if (!auth.currentUser) {
      alert("Tenes que iniciar sesion");
      return;
    }

    if (!puedeEditar) {
      alert("No tenés permisos para editar esta historia.");
      return;
    }

    try {
      setSaving(true);
      const updatePayload = buildUpdatePayload();
      const obraPayload = safeFirestorePayload({
        ...stripTransientFields(buildObraFromHistoria({
          ...obra,
          ...updatePayload,
          id: obraId
        })),
        ...updatePayload,
        tipo: obra.tipo || OBRA_TYPE_ORIGINAL,
        autorId: obra.autorId || obra.creadoPor || auth.currentUser.uid,
        creadoPor: obra.creadoPor || obra.autorId || auth.currentUser.uid,
        historiaLegacyId: obraId,
        legacySource: "historias"
      });

      await setDoc(doc(db, "obras", obraId), obraPayload, { merge: true });

      const capitulosSnap = await getDocs(
        collection(db, "historias", obraId, "capitulos")
      );

      await Promise.all(
        capitulosSnap.docs.map((capituloDoc) =>
          setDoc(
            doc(db, "obras", obraId, "capitulos", capituloDoc.id),
            safeFirestorePayload({
              ...capituloDoc.data(),
              origen: "original",
              historiaLegacyId: obraId
            }),
            { merge: true }
          )
        )
      );

      alert("Historia migrada a obras sin borrar la original");
      navigate(`/obra/${obraId}`);
    } catch (error) {
      console.error("Error completo al migrar historia:", error);
      alert(error.message || "Error desconocido al migrar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="page">Cargando historia...</p>;
  }

  if (!obra) {
    return <p className="page">No se encontro la historia.</p>;
  }

  if (!auth.currentUser || !puedeEditar) {
    return <p className="page">No tenés permisos para editar esta historia.</p>;
  }

  return (
    <main className="page page-form">
      <Link to={`/obra/${obraId}`} className="text-link">
        Volver al detalle
      </Link>

      <p className="section-kicker">
        {source === "historias" ? "Historia antigua" : "Obra"}
      </p>
      <h2>Editar historia</h2>

      <input
        placeholder="Titulo"
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        className="form-field"
      />

      <textarea
        placeholder="Descripcion"
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        rows={4}
        className="form-field full-width"
      />

      <input
        placeholder="Generos separados por coma"
        value={generos}
        onChange={(event) => setGeneros(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="Etiquetas separadas por coma"
        value={etiquetas}
        onChange={(event) => setEtiquetas(event.target.value)}
        className="form-field"
      />

      <input
        placeholder="URL de portada"
        value={portadaUrl}
        onChange={(event) => setPortadaUrl(event.target.value)}
        className="form-field"
      />

      <div className="image-preview">
        <div className="image-preview-frame">
          {portadaUrl ? (
            <img src={portadaUrl} alt="Vista previa de portada" />
          ) : (
            <span>{(titulo || "N").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <p>Vista previa de portada</p>
      </div>

      {esObraExterna && (
        <>
          <input
            placeholder="Autor original"
            value={autorOriginal}
            onChange={(event) => setAutorOriginal(event.target.value)}
            className="form-field"
          />

          <div className="form-grid">
            <input
              placeholder="Idioma original"
              value={idiomaOriginal}
              onChange={(event) => setIdiomaOriginal(event.target.value)}
              className="form-field"
            />

            <input
              placeholder="Pais de origen"
              value={paisOrigen}
              onChange={(event) => setPaisOrigen(event.target.value)}
              className="form-field"
            />
          </div>
        </>
      )}

      <section className="advanced-settings-panel">
        <div className="section-heading">
          <p className="section-kicker">Ajustes avanzados</p>
          <h3>Permisos y traducciones</h3>
        </div>

        <label className="form-check">
          <input
            type="checkbox"
            checked={permiteTraducciones}
            onChange={(event) => setPermiteTraducciones(event.target.checked)}
          />
          Permitir traducciones de esta obra
        </label>

        <textarea
          placeholder="Colaboradores permitidos, un UID o email por linea"
          value={colaboradores}
          onChange={(event) => setColaboradores(event.target.value)}
          rows={4}
          className="form-field full-width"
        />

        <textarea
          placeholder="Traductores autorizados, un UID o email por linea"
          value={traductoresAutorizados}
          onChange={(event) => setTraductoresAutorizados(event.target.value)}
          rows={4}
          className="form-field full-width"
        />
      </section>

      <div className="form-actions">
        <button onClick={guardarCambios} disabled={saving}>
          Guardar cambios
        </button>

        {source === "historias" && (
          <button
            type="button"
            className="btn-filter-reset"
            onClick={migrarAObra}
            disabled={saving}
          >
            Migrar a obras
          </button>
        )}
      </div>
    </main>
  );
}
