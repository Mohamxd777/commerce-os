import { useCallback, useEffect, useState } from 'react';
import { imageApi } from '../../api/imageApi.js';

export default function ImageGallery({ organizationId, entityType, entityId, title = 'Managed images', allowUpload = true }) {
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      const result = await imageApi.list(organizationId, entityType, entityId);
      setImages(result.data);
      setError('');
    } catch (requestError) { setError(requestError.message); }
  }, [organizationId, entityType, entityId]);

  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      await imageApi.upload(organizationId, file, entityType, entityId, images.length === 0);
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); event.target.value = ''; }
  }

  async function setPrimary(imageId) {
    setBusy(true);
    try { await imageApi.setPrimary(organizationId, imageId, { entityType, entityId }); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function remove(imageId) {
    if (!window.confirm('Remove this image from this record?')) return;
    setBusy(true);
    try { await imageApi.remove(organizationId, imageId, entityType, entityId); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section className="workspace-card managed-image-section">
    <div className="detail-card-heading"><div><p className="eyebrow">Local app storage</p><h2>{title}</h2></div><span>{images.length} images</span></div>
    <p className="form-note">PNG and JPEG only. Files are kept in managed local app data, outside the repository and database.</p>
    {allowUpload && <label className="secondary-button image-upload-button">{busy ? 'Working…' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={upload} disabled={busy} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {images.length === 0 ? <div className="empty-state compact"><h3>No local images</h3><p>Upload a product photo or import a confirmed Noon image.</p></div> : <div className="managed-image-grid">
      {images.map((item) => <article key={item.id} className={item.is_primary ? 'primary' : ''}>
        <a href={imageApi.contentUrl(item.id, organizationId)} target="_blank" rel="noreferrer"><img src={imageApi.contentUrl(item.id, organizationId)} alt={item.original_filename} /></a>
        <div><strong>{item.is_primary ? 'Primary · ' : ''}{item.original_filename}</strong><small>{item.source === 'noon_import' ? 'Imported from Noon' : 'Uploaded'} · {Math.ceil(Number(item.byte_size) / 1024)} KB</small></div>
        <div className="compact-actions">{!item.is_primary && <button className="secondary-button" disabled={busy} onClick={() => setPrimary(item.id)}>Make primary</button>}<button className="danger-button" disabled={busy} onClick={() => remove(item.id)}>Delete</button></div>
      </article>)}
    </div>}
  </section>;
}

