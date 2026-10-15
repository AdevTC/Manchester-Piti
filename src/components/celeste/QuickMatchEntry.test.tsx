import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ClubMatch } from '../../lib/clubData';
const state=vi.hoisted(()=>({save:vi.fn()}));
vi.mock('../../lib/clubApi',()=>({liveEvent:state.save,apiError:(e:Error)=>e.message}));
vi.mock('../../hooks/useClock',()=>({useClock:()=>600_000}));
import { QuickMatchEntry } from './QuickMatchEntry';
const match:ClubMatch={id:'m',status:'scheduled',starters:['a','b','c','d','e','f','g'],bench:['h'],events:[],clock:{phase:'first',revision:1,firstStartedAt:0}};
const renderEntry=(m=match)=>render(<QuickMatchEntry match={m} nameOf={id=>`Jugador ${id}`}/>);
beforeEach(()=>state.save.mockReset().mockResolvedValue({}));
it('guarda gol en dos toques con asistencia pendiente y deshace solo su propio evento',async()=>{
  const {rerender}=renderEntry();
  fireEvent.click(screen.getByRole('button',{name:'Gol del Piti'}));fireEvent.click(screen.getByRole('button',{name:'Jugador a'}));
  await waitFor(()=>expect(state.save).toHaveBeenCalledTimes(1));
  const payload=state.save.mock.calls[0][0];expect(payload.event).toMatchObject({type:'goal',playerId:'a',assistReviewed:false,minute:10});
  await screen.findByText(/Asistencia pendiente de revisar en el acta/);
  rerender(<QuickMatchEntry match={{...match,events:[{id:`live-${payload.requestId}`,type:'goal',minute:10,playerId:'a'},{id:'live-otro',type:'opponent_goal',minute:10}]}} nameOf={id=>`Jugador ${id}`}/>);
  fireEvent.click(screen.getByRole('button',{name:/Deshacer mi última/}));
  expect(state.save).toHaveBeenLastCalledWith({action:'undo',matchId:'m',eventId:`live-${payload.requestId}`});
});
it('un reintento conserva la identidad de la jugada y bloquea nuevas acciones hasta resolverlo',async()=>{
  state.save.mockRejectedValueOnce(new Error('Sin conexión'));
  renderEntry();fireEvent.click(screen.getByRole('button',{name:'Gol rival'}));
  await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Gol rival'})).toBeDisabled();
  const first=state.save.mock.calls[0][0];fireEvent.click(screen.getByRole('button',{name:'Reintentar la misma jugada'}));
  await waitFor(()=>expect(state.save).toHaveBeenCalledTimes(2));expect(state.save.mock.calls[1][0]).toEqual(first);
});
it('sincroniza descanso y jugadores: no permite goles ni sustituir a alguien que otro ya cambió',()=>{
  const {rerender}=renderEntry();fireEvent.click(screen.getByRole('button',{name:'Cambio'}));fireEvent.click(screen.getByRole('button',{name:'Jugador a'}));
  rerender(<QuickMatchEntry match={{...match,events:[{id:'other',type:'substitution',minute:9,playerId:'a',inPlayerId:'h'}]}} nameOf={id=>`Jugador ${id}`}/>);
  expect(screen.getByText(/Otro anotador ya cambió/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Cancelar selección'}));
  rerender(<QuickMatchEntry match={{...match,clock:{...match.clock!,phase:'halftime',firstEndedAt:500000}}} nameOf={id=>`Jugador ${id}`}/>);
  expect(screen.getByRole('button',{name:'Gol rival'})).toBeDisabled();expect(screen.getByRole('button',{name:'Amarilla'})).toBeEnabled();
});
