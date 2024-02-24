export type StandardOpsActionTypes =
	| 'state-reset'
	| 'std-ops'
	| `std-ops:change:${string}`;

export type Action<Meta = any, Type = string> = Meta & {
	type: Type | StandardOpsActionTypes;
};

export type StateTransientProps = {
	/**
	 * A list of events to dispatch before main `action:*` events get triggered.
	 * Use this in cases where the main action implicitly equals 1 or more
	 * 'deeper' events. Caveats:
	 *
	 * 1. `action:` is prefixed to each event
	 * 2. events **are not** cascaded
	 */
	__innerEvents?: string[];
	/**
	 * Since innerEvents don't cascade, you can also attach additional metadata
	 * about changed keys.
	 */
	__changedKeys?: string[];
};

export type StateReducer<State, ActionMeta, ActionType = string> = (
	action: Action<ActionMeta, ActionType>,
	state: State & StateTransientProps
) => (State & StateTransientProps) | undefined;

export type ActionEventHandler<
	State = any,
	ActionMeta = any,
	ActionType = string
> = (
	event: string,
	payload: {
		action?: Action<ActionMeta, ActionType>;
		state: State & StateTransientProps;
		meta?: { innerEvents?: string[]; changedKeys?: string[] };
	}
) => void;

export type ActionStore<State = any, ActionMeta = any, ActionType = string> = {
	resetState(state: State): State;
	updateState(partial: Partial<State>): State;
	getState(): State;
	dispatch(action: Action<ActionMeta, ActionType>): void;
	listenFor(
		event: string,
		handler: ActionEventHandler<State, ActionMeta, ActionType>
	): () => void;
};

export type ActionStoreBuilder<State = any, ActionMeta = any> = ActionStore<
	State,
	ActionMeta
> & {
	/** Adds a reducer to the top of the list. */
	prependReducer: (reducer: StateReducer<State, ActionMeta>) => void;
	/** Adds a reducer to the bottom of the list. */
	appendReducer: (reducer: StateReducer<State, ActionMeta>) => void;
};

export type ActionStoreEvents = 'state-reset' | 'action' | `action:${string}`;

export type StandardOpsActionMeta = {
	/** If not defined, `.` (root of state) is used. */
	path?: string;
	/**
	 * If given, the subgraph pointed to by `path` will be passed into this function and
	 * updated with the return value. **Only return modified keys, and return deleted keys
	 * using undefined values.**
	 *
	 * **Don't be clever: this should be a pure function.**
	 *
	 * If `customOp` is given, no other operations will be applied.
	 *
	 * @return If undefined, no state change will occur.
	 */
	customOp?: (action: Action, subgraph: any) => any;
	/** Removes existing keys from path. */
	remove?: string[];
	/** Adds only new keys to `path` */
	append?: Record<string, any>;
	/** Adds/overwrites keys to `path` */
	set?: Record<string, any>;
	/**
	 * If given keys match `state[*path][keys*]` as numbers, the state values are incremented
	 * by the map amount.
	 *
	 * E.g. `typeof subgraph[key] === 'number' && subgraph[key] += increment[key]`)
	 */
	increment?: Record<string, number>;
};
