import { useEffect, useState } from 'react';
import { makeEventBus } from '../utils';
import { getDataByPath, jsonClone } from '../formHelp';
import type {
	Action,
	ActionEventHandler,
	ActionStore,
	ActionStoreBuilder,
	ActionStoreEvents,
	StandardOpsActionMeta,
	StateReducer,
	StateTransientProps,
} from './types';
export * from './types';

export class ActionStoreImpl<State = any, ActionMeta = any, ActionType = string>
	implements ActionStoreBuilder<State, ActionMeta>
{
	events = makeEventBus<ActionStoreEvents>();
	state: State & StateTransientProps;
	reducers: StateReducer<State, ActionMeta, string>[] = [];
	id: string;

	constructor(
		state: State,
		opts?: { reducers?: StateReducer<State, ActionMeta, string>[] }
	) {
		this.id = new Date().toISOString();
		this.state = jsonClone(state);
		if (opts?.reducers) {
			this.reducers = [...opts.reducers];
		}
	}

	resetState(state: State): State {
		this.state = this.applyReducers({ type: 'state-reset' }, this.state);
		this.events.emit('state-reset', { state: this.state });
		return this.state;
	}

	updateState(p: Partial<State>): State {
		this.state = this.applyReducers(
			{ type: 'state-reset' },
			{ ...this.state, ...p }
		);
		this.events.emit('state-reset', { state: this.state });
		return this.state;
	}

	getState(): State {
		return { ...this.state };
	}

	prependReducer(reducer: StateReducer<State, ActionMeta, string>) {
		this.reducers.unshift(reducer);
		return;
	}

	appendReducer(reducer: StateReducer<State, ActionMeta, string>) {
		this.reducers.push(reducer);
		return;
	}

	protected cascadeEmit(
		event: string,
		action: Action<ActionMeta>,
		state: State,
		meta?: Record<string, any>
	) {
		const levels = event.split(':');
		while (levels.length > 0) {
			const evt = levels.join(':');
			levels.pop();
			this.events.emit(evt as ActionStoreEvents, {
				action,
				state,
				meta,
			});
		}
	}

	applyReducers(
		action: Action<any, string>,
		ostate: State & StateTransientProps
	) {
		let nstate = ostate;
		for (const reducer of this.reducers) {
			const ts = reducer(action, nstate);
			if (ts) {
				nstate = ts;
			}
		}
		return nstate;
	}

	dispatch(action: Action<ActionMeta, string>): void {
		const ostate = jsonClone<State & StateTransientProps>(this.state);
		const nstate = this.applyReducers(action, ostate);

		if (nstate !== ostate) {
			const innerEvents = nstate.__innerEvents ?? [];
			const changedKeys = nstate.__changedKeys ?? [];
			delete nstate.__innerEvents;
			delete nstate.__changedKeys;

			const meta = {
				innerEvents,
				changedKeys,
			};

			const sent: Record<string, boolean> = {};
			innerEvents.forEach((ievt) => {
				if (sent[ievt]) return;
				sent[ievt] = true;
				this.events.emit(`action:${ievt}`, {
					action,
					state: nstate,
					meta,
				});
			});

			this.cascadeEmit(`action:${action.type}`, action, nstate, meta);
			this.state = { ...nstate };
		}
	}

	/**
	 * A convenience method to dispatch `std-ops` actions.
	 */
	dispatchStdOps(action: StandardOpsActionMeta) {
		this.dispatch({ ...action, type: 'std-ops' } as any);
	}

	listenFor(
		event: ActionStoreEvents,
		handler: ActionEventHandler<State, ActionMeta>
	): () => void {
		return this.events.addListener(event, handler);
	}
}

export function useActionStore<
	State = any,
	ActionMeta = any,
	ActionType = string
>(
	store: ActionStore<State, ActionMeta, ActionType>,
	{
		eventScopes = ['reset-state', 'action'],
		handler,
	}: {
		eventScopes?: string[];
		handler?: ActionEventHandler<State, ActionMeta>;
	} = {}
) {
	const [state, setState] = useState(store.getState());
	useEffect(() => {
		const funcs: Function[] = [];
		for (const eventScope of eventScopes) {
			funcs.push(
				store.listenFor(eventScope, (event, payload) => {
					handler?.(event, payload as any);
					setState(payload.state);
				})
			);
		}
		return () => funcs.forEach((f) => f());
	});
	return state;
}

/**
 * StandardOps is a ready-to-go solution for ActionStore that lets users manipulate
 * arbitrarily deep objects and receive granular events. You pass in a `path`, which
 * is a relative path-based format (e.g. `.`, `a`, `a/b`), which determines the
 * subgraph in the state to edit, and 1+ of the supported operation key-values.
 *
 * The following __innerEvents are generated:
 *
 * - `action:std-ops:change:$path:[...$changedKeys]` (1+)
 * - `action:std-ops:change:$path`
 * - `action:std-ops:change`
 * - `action:std-ops`
 *
 * > Note that we don't cascade on `path` -- this is up to you.
 *
 * [See the unit tests for a working example](./standard-ops.test.ts)
 */
export const standardOpsReducer: StateReducer<any, StandardOpsActionMeta> = (
	action,
	state
) => {
	if (action.type !== 'std-ops') {
		return;
	}

	const { path = '.', customOp, append, set, increment, remove } = action;
	const __innerEvents: string[] = [];
	const newKeys: Record<string, boolean> = {};
	const curVals = { ...getDataByPath(state, path) };
	let changed = 0;

	if (customOp) {
		let nstate = { ...state };
		getDataByPath(nstate, path, (ptr) => {
			const subgraph = customOp(action, ptr) ?? {};
			if (!subgraph) return;
			for (const key in subgraph) {
				if (subgraph[key] === undefined) {
					delete ptr[key];
				} else {
					ptr[key] = subgraph[key];
				}

				newKeys[key] = true;
				__innerEvents.push(`std-ops:change:${path}:${key}`);
			}
		});

		if (__innerEvents.length == 0) return;

		nstate.__innerEvents = [
			...__innerEvents,
			`std-ops:change:${path}`,
			'std-ops:change',
		];
		nstate.__changedKeys = Object.keys(newKeys);
		return nstate;
	}

	if (remove) {
		for (const key of remove) {
			if (curVals[key] !== undefined) {
				curVals[key] = undefined;
				newKeys[key] = true;
				changed++;
			}
		}
	}

	if (append) {
		for (const key in append) {
			if (curVals[key] === undefined) {
				curVals[key] = append[key];
				newKeys[key] = true;
				changed++;
			}
		}
	}

	if (set) {
		for (const key in set) {
			curVals[key] = set[key];
			newKeys[key] = true;
			changed++;
		}
	}

	if (increment) {
		for (const key in increment) {
			// @todo validate increment[key]
			if (typeof curVals[key] === 'number') {
				curVals[key] += increment[key];
				changed++;
			}
		}
	}

	if (!changed) {
		return;
	}

	const nstate = { ...state };
	getDataByPath(nstate, path, (ptr) => {
		for (const key in newKeys) {
			if (curVals[key] === undefined) {
				delete ptr[key];
			} else {
				ptr[key] = curVals[key];
			}
			__innerEvents.push(`std-ops:change:${path}:${key}`);
		}
	});
	__innerEvents.push(`std-ops:change:${path}`, 'std-ops:change');
	return { ...nstate, __innerEvents, __changedKeys: Object.keys(newKeys) };
};
