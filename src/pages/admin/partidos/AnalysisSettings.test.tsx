import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AnalysisSettings } from './AnalysisSettings';
import { emptyNarratedAnalysis } from '../../../../functions/src/narrated/editing';

it('adds, edits and removes coverage and parameters with contract validation', () => {
  const onSave = vi.fn();
  render(<AnalysisSettings analysis={emptyNarratedAnalysis()} onSave={onSave} sources={[]} onSources={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar cobertura y reglas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Añadir cobertura' }));
  fireEvent.change(screen.getByLabelText('Cobertura 1'), { target: { value: 'complete' } });
  fireEvent.change(screen.getByLabelText('Inicio del tramo 1'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura y reglas' }));
  expect(screen.getByRole('alert')).toHaveTextContent('ambos extremos');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Final del tramo 1'), { target: { value: '3000' } });
  const profile = emptyNarratedAnalysis().profile; profile.parameters = { windowSeconds: 90 };
  fireEvent.change(screen.getByLabelText('Perfil y parámetros (JSON)'), { target: { value: JSON.stringify(profile) } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura y reglas' }));
  expect(onSave.mock.calls[0][0].coverage).toEqual([{ family: 'pass', team: 'us', state: 'complete', from: 0, to: 3000 }]);
  expect(onSave.mock.calls[0][0].profile.parameters).toEqual({ windowSeconds: 90 });
});

it('edits only working sources and rejects invalid source intervals', () => {
  const sources = [{ id: 'original', quote: 'Cita original' }], onSources = vi.fn();
  render(<AnalysisSettings analysis={emptyNarratedAnalysis()} onSave={vi.fn()} sources={sources} onSources={onSources} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar fuentes de trabajo' }));
  fireEvent.change(screen.getByLabelText('Fuentes privadas (JSON)'), { target: { value: '[{"id":"original","quote":"Corrección","audioFrom":20,"audioTo":10}]' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar fuentes de trabajo' }));
  expect(onSources).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Fuentes privadas (JSON)'), { target: { value: '[]' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar fuentes de trabajo' }));
  expect(onSources).toHaveBeenCalledWith([]);
  expect(sources[0].quote).toBe('Cita original');
});

it('retains edits but rejects stale settings and sources after remote changes', () => {
  const onSave = vi.fn(), onSources = vi.fn(), analysis = emptyNarratedAnalysis();
  const props = { analysis, onSave, sources: [{ id: 's', quote: 'Original' }], onSources };
  const { rerender } = render(<AnalysisSettings {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar cobertura y reglas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Añadir cobertura' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar fuentes de trabajo' }));
  fireEvent.change(screen.getByLabelText('Fuentes privadas (JSON)'), { target: { value: '[{"id":"s","quote":"Mi revisión"}]' } });
  rerender(<AnalysisSettings {...props} analysis={{ ...analysis, coverage: [{ family: 'shot', team: 'us', state: 'partial' }] }} sources={[{ id: 's', quote: 'Corrección remota' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura y reglas' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('han cambiado');
  expect(screen.getByLabelText('Familia 1')).toHaveValue('pass');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar fuentes de trabajo' }));
  expect(onSources).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Fuentes privadas (JSON)')).toHaveValue('[{"id":"s","quote":"Mi revisión"}]');
});
