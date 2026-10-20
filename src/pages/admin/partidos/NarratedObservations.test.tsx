import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { NarratedObservations } from './NarratedObservations';
import type { Observation } from '../../../../functions/src/narrated/types';

const observation: Observation = { id: 'pass', kind: 'pass', team: 'us', actorId: 'a', order: 1, facts: { outcome: 'complete' } };
it('refuses a stale observation form after a remote correction without losing typed input', () => {
  const onSave = vi.fn();
  const props = { observations: [observation], nameOf: (id: string) => id, onSave };
  const { rerender } = render(<NarratedObservations {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar detalle' }));
  const local = { ...observation, facts: { outcome: 'complete', underPressure: true } };
  fireEvent.change(screen.getByLabelText('Observación completa (JSON)'), { target: { value: JSON.stringify(local) } });
  rerender(<NarratedObservations {...props} observations={[{ ...observation, actorId: 'b' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar detalle' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('ha cambiado');
  expect(screen.getByLabelText('Observación completa (JSON)')).toHaveValue(JSON.stringify(local));
});
it('orders exact times only when requested and leaves untimed observations in their slots', () => {
  const onReorder = vi.fn(), onSave = vi.fn();
  const observations: Observation[] = [
    { ...observation, id: 'late', order: 1, time: { from: 600, to: 600, precision: 'exact' } },
    { ...observation, id: 'unknown', order: 2 },
    { ...observation, id: 'early', order: 3, time: { from: 120, to: 120, precision: 'exact' } },
  ];
  render(<NarratedObservations observations={observations} nameOf={id => id} onSave={onSave} onReorder={onReorder} />);
  expect(onReorder).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ordenar hechos con tiempo' }));
  expect(onReorder.mock.calls[0][0].map((o: Observation) => [o.id, o.order])).toEqual([['early', 1], ['unknown', 2], ['late', 3]]);
});
