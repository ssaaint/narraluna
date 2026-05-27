import { useMemo, useState } from "react";
import { parseChapterImages, textOrEmpty } from "../utils/firestoreSafe";

const imagesToText = (images) =>
  images
    .map((image) =>
      image.caption ? `${image.url} | ${image.caption}` : image.url
    )
    .join("\n");

export default function ChapterImagesInput({ value, onChange }) {
  const images = useMemo(() => parseChapterImages(value), [value]);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const addImage = () => {
    const imageUrl = textOrEmpty(url);
    if (!imageUrl) return;

    onChange(imagesToText([...images, { url: imageUrl, caption: textOrEmpty(caption) }]));
    setUrl("");
    setCaption("");
  };

  const removeImage = (imageUrl) => {
    onChange(imagesToText(images.filter((image) => image.url !== imageUrl)));
  };

  return (
    <section className="chapter-images-input">
      <div className="section-heading">
        <p className="section-kicker">Imagenes del capitulo</p>
        <h3>Agregar imagenes por URL</h3>
      </div>

      <div className="chapter-image-form">
        <input
          placeholder="URL de imagen"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="form-field"
        />
        <input
          placeholder="Caption opcional"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="form-field"
        />
        <button type="button" onClick={addImage}>
          Agregar imagen
        </button>
      </div>

      {images.length > 0 && (
        <div className="chapter-image-preview-grid">
          {images.map((image) => (
            <figure key={image.url} className="chapter-image-preview">
              <img src={image.url} alt={image.caption || "Imagen del capitulo"} />
              <figcaption>{image.caption || "Sin caption"}</figcaption>
              <button type="button" onClick={() => removeImage(image.url)}>
                Eliminar
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
