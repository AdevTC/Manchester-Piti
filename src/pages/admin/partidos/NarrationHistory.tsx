import { useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../../firebase';
import { narrationSourcesSchema, type NarrationSource } from '../../../../functions/src/narrated/schema';
import { LazyDetails } from './LazyDetails';

interface Revision { id: string; revision: number; sources: NarrationSource[]; when: string }
export function NarrationHistory({ matchId, onUseSources }: { matchId: string; onUseSources: (sources: NarrationSource[]) => void }) {
  const [rows, setRows] = useState<Revision[]>([]), [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null), [loaded, setLoaded] = useState(false), [more, setMore] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async () => { setBusy(true); setError(''); try {
    const path = collection(db, 'matchPrivate', matchId, 'analysisHistory');
    const result = await getDocs(query(path, orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(10)));
    setRows(current => [...current, ...result.docs.map(doc => { const data = doc.data(); const parsed = narrationSourcesSchema.safeParse(data.sources ?? []); const date = data.createdAt?.toDate?.(); return { id: doc.id, revision: data.revision ?? 0, sources: parsed.success ? parsed.data : [], when: date instanceof Date ? date.toLocaleString('es-ES') : 'Fecha no disponible' }; })]);
    setCursor(result.docs.at(-1) ?? null); setMore(result.size === 10); setLoaded(true);
  } catch { setError('No se ha podido cargar el historial privado. Solo los administradores pueden consultarlo.'); } finally { setBusy(false); } };
  return <LazyDetails className="ae-history"><summary>Historial privado de fuentes</summary><p>Estas revisiones son originales y no se sobrescriben. Las correcciones se guardan en una versión nueva del acta.</p>{!loaded && <button className="btn line" type="button" disabled={busy} onClick={() => void load()}>{busy ? 'Cargando historial…' : 'Consultar historial privado'}</button>}{rows.map(row => <LazyDetails key={row.id}><summary>Revisión {row.revision} · {row.when} · {row.sources.length} fuentes</summary>{row.sources.map(source => <blockquote key={source.id}><b>{source.id}</b>{source.audioFrom != null && <small>Audio {source.audioFrom}s{source.audioTo != null ? `–${source.audioTo}s` : ''}</small>}<p>{source.quote}</p></blockquote>)}{!!row.sources.length && <button type="button" className="btn line" onClick={() => onUseSources(row.sources)}>Usar estas fuentes en la versión de trabajo</button>}</LazyDetails>)}{loaded && !rows.length && <p>Aún no hay revisiones publicadas de esta narración.</p>}{loaded && more && <button className="btn line" type="button" disabled={busy} onClick={() => void load()}>Cargar más revisiones</button>}{error && <p role="alert">{error}</p>}</LazyDetails>;
}
