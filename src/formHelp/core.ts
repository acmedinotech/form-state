import { createContext } from 'react';
import type { EventBus } from '../utils';

export const jsonClone = <Type = any>(obj: any): Type =>
	JSON.parse(JSON.stringify(obj));

export type ScopeProps = {
	/** The enclosing scope of the component. Use this to propagate scopes down the tree. */
	parentScope?: string;
	/** The scope of the component. */
	scope?: string;
	/** The name of the control being updated/blurred. */
	name?: string;
};

export const DS_KEY_SCOPE = 'fhscope';
export const DS_KEY_BOOL = 'fhbool';
export const DS_KEY_VAL_UNCHECKED = 'fhvalunchecked';
export const DS_KEY_PARTITION = 'fhpartition';

/**
 * Returns `data-` props corresponding to given flag values.
 * @param param0
 * @returns
 */
export const getDataProps = ({
	scope,
	bool,
	valUnchecked,
	partition,
}: {
	scope?: string;
	bool?: boolean;
	valUnchecked?: string;
	partition?: boolean;
}) => {
	return {
		'data-fhscope': scope,
		'data-fhbool': bool ? '' : undefined,
		'data-fhvalunchecked': valUnchecked,
		'data-fhpartition': partition,
	};
};

export type FHData<Type = any> = Type;

export const ENCTYPE_MULTIPART = 'multi-part/form-data';
export const ENCTYPE_URLENCODED = 'application/x-www-form-urlencoded';
export const ENCTYPE_JSON = 'application/json';

export type SubmitHandlerParams = {
	action?: string;
	method?: string;
	encType?: string;
	headers?: Record<string, string>;
};

export type SubmitHandler = (
	data: FHData,
	params?: SubmitHandlerParams
) => Promise<Response>;

/**
 * Submits the form based on action, method, and content encoding type.
 * Handles standard querystring/mutipart and JSON.
 */
export const defaultSubmitHandler: SubmitHandler = async (
	data,
	{ action = '', method = 'POST', encType = ENCTYPE_JSON, headers = {} } = {}
) => {
	let body: any = undefined;

	if (encType === ENCTYPE_JSON) {
		if (method && method !== 'GET' && method !== 'HEAD')
			body = JSON.stringify(data);
	} else {
		const fd =
			encType === ENCTYPE_URLENCODED
				? new URLSearchParams()
				: new FormData();
		for (const [key, value] of Object.entries(data)) {
			if (value instanceof Array) {
				for (const v of value) {
					fd.append(key, v);
				}
			} else {
				fd.append(key, value + '');
			}
		}
		body = fd;
	}

	return fetch(action, {
		method,
		headers: {
			'content-type': encType,
			...headers,
		},
		body,
	});
};

/**
 * Returns wrapper to `defaultSubmitHandler` with pre-filled params.
 */
export const makeSubmitHandler = (
	rootParams: Partial<SubmitHandlerParams> = {}
): SubmitHandler => {
	return async (data, params) =>
		defaultSubmitHandler(data, { ...rootParams, ...params });
};

export type FHContextProps<Data = any> = {
	events: EventBus<'updated' | 'reset' | 'set-initial'>;
	data: FHData<Data>;
	initialData: FHData<Data>;
	scope?: string;
	getChangelog: () => DiffResults[];
	clearChangelog: () => DiffResults[];
	getData(): FHData<Data>;
	getScopedData: (scope: string) => any | undefined;
	getInitial(): FHData<Data>;
	/**
	 * Explicitly invokes a blur event. This is necessary on mobile devices
	 * where blur behavior does not act like desktop -- one possibility for
	 * use is to display a floating checkmark button to invoke blur. This is
	 * also used for synthetic controls to emulate native lifecycles.
	 */
	blur: (
		scope: string,
		nameOrEvt?: string | React.FocusEvent<HTMLElement>,
		optEvt?: React.FocusEvent<HTMLElement>
	) => void;
	bindToBlurredScope: (
		path: string,
		handler: (
			scope: string,
			evt: React.FocusEvent<HTMLElement>,
			/** Set when `scope` ends with `/*` */
			originalScope?: string
		) => void
	) => () => void;
	/**
	 * Binds a handler to either a specific field (when both `scope` and `name` are given)
	 * or to a collection of diffs for a `scope`. Handlers bound to these events are fired
	 * before the whole form's `updated` event.
	 *
	 * @param handler
	 * @param scope If given without `name`, handler will be bound to all of scope's events
	 * @param name If given, handler will be bound to the specific field's diff event.
	 * @returns
	 * @todo change args to ({scope,name?}, handler)
	 */
	bindToUpdatedScope: (
		handler: (
			/** The scope or field path. */
			eventName: string,
			args:
				| {
						/** Full path to this field */
						path: string;
						/** Name of this field. */
						name: string;
						/** Parent scope of field. */
						scope: string;
						/** Together with name, signals that a specific field has changed. */
						valDiff: DiffEntry;
				  }
				| {
						scope: string;
						/** Together with scope, signals that 1 or more fields under a scope have changed */
						diff: DiffResults;
				  }
		) => void,
		scope: string,
		name?: string
	) => () => void;
	/**
	 * Creates/overwrites control's value at the given scope. Emits `updated`.
	 * @param name
	 * @param value
	 * @param scope
	 * @returns
	 */
	setControlValue: (name: string, value: any, scope?: string) => void;
	/**
	 * The low-level update call used by input/textarea/selectChanged to
	 * incrementally modify a control value. Use this if you have a mix of
	 * non-standard control lifecycles and native control lifecycles
	 * affecting the same checkbox-multiple name
	 * @returns
	 */
	updateControlValue: ({
		scope,
		name,
		value,
		isArray,
		isArrRemove,
	}: {
		/** Scope of affected control. Use `''` for root of form. */
		scope: string;
		/** Name of affected control. */
		name: string;
		value?: string | boolean | string[];
		/** Treats `name` as an array */
		isArray?: boolean;
		/** Remove `value` from array if true */
		isArrRemove?: boolean;
	}) => void;
	setData: (data: FHData<Data>, scope?: string) => void;
	setInitial: (data: FHData<Data>, scope?: string) => void;
	/** Overwrites `data` with `initialData`. Emits `reset`. */
	reset: () => void;
	/** Resets individual control. Emits `updated` */
	resetControl: (name: string, scope?: string) => void;
	submit: SubmitHandler;
	create: (scope?: string, params?: SubmitHandlerParams) => Promise<any>;
	update: (scope?: string, params?: SubmitHandlerParams) => Promise<any>;
	delete: (scope?: string, params?: SubmitHandlerParams) => Promise<any>;
};
export const FHContext = createContext<FHContextProps>({} as any);

/**
 * An individual component in a `/`-separated path that references a whole object/array,
 * a specific array index, or a specific map key.
 *
 * - `name` -> `{name:'name'}`
 * - `name[]` -> `{name: 'name', isArray: true}`
 * - `name[0]` -> `{name: 'name', isArray: true, index: 0}`
 * - `name[alpha]` -> `{name: 'name', key: 'alpha'}`
 * - `[alpha]` -> `{name: '', key: 'alpha'}` is a special case that references previous
 *   resolved component data
 * - NOT ALLOWED: `[]` and `[index]` (previous resolved component data will always be an
 *   object, never an array)
 */
export type PathComponent = {
	name: string;
	isArray?: boolean;
	index?: number;
	key?: string;
};

/**
 * Convert raw path component to its parts.
 */
export const parsePathComponent = (component: string): PathComponent => {
	const [name, restIndex] = component.split('[');
	const ret: PathComponent = {
		name,
	};

	if (restIndex) {
		const [rawIndex] = restIndex.split(']');
		const index = parseInt(rawIndex);
		if (rawIndex) {
			if (isNaN(index)) {
				ret.key = rawIndex;
			} else {
				ret.isArray = true;
				ret.index = index;
			}
		} else {
			ret.isArray = true;
		}
	}

	return ret;
};

/**
 * Resolves a `/`-delimited path within an object, optionally executes an
 * insert callback with the resolved object, and returns the resolved object.
 * This allows for out-of-order, iterative graph creation,
 *
 * @param data
 * @param path
 * @return The object pointed to by the leaf component
 */
export const getDataByPath = (
	data: FHData,
	path: string,
	insertFn?: (map: any) => void
): FHData => {
	let ptr = data;
	for (const component of path.split('/')) {
		if (component === '') {
			break;
		}
		if (component === '.') {
			continue;
		}

		// todo: guard against current `name` object being referenced as an array
		const { name, isArray, index, key } = parsePathComponent(component);
		let target = ptr;
		if (name && !ptr[name]) {
			if (isArray) {
				if (!ptr[name]) {
					ptr[name] = [];
					target = ptr[name];
				}
			} else {
				ptr[name] = {};
				target = ptr[name];
			}
		} else if (name) {
			target = ptr[name];
		} else if (isArray) {
			// unnamed []
			throw new Error(
				`unnamed array not allowed. failed parsing '${component}' in '${path}'`
			);
		}

		if (isArray) {
			if (index !== undefined) {
				// [index]
				target[index] = target[index] ?? {};
				ptr = target[index];
			} else {
				// []
				target.push({});
				ptr = target[target.length - 1];
			}
		} else {
			if (key) {
				if (!target[key]) {
					target[key] = {};
				}
				ptr = target[key];
			} else {
				ptr = target;
			}
		}
	}
	insertFn?.(ptr);
	return ptr;
};

export const getScopeAndName = (
	ele?: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
) => {
	if (!ele) {
		return { scope: '', name: '' };
	}
	let prefix = '';
	let name = ele.name;
	const parts = name.split('/');
	if (parts.length > 1) {
		name = parts.pop() as string;
		prefix = parts.join('/');
	}

	// traverse up to <form/> to build scope tree
	// @todo check for data-form-start (for sub-forms)
	const allScopes: string[] = [];
	let sptr = ele as HTMLElement | null;
	while (sptr) {
		if (sptr.tagName === 'FORM' || sptr.dataset[DS_KEY_PARTITION]) {
			break;
		}
		if (sptr.dataset[DS_KEY_SCOPE]) {
			allScopes.push(sptr.dataset[DS_KEY_SCOPE]);
		}
		sptr = sptr.parentElement;
	}

	let scope = allScopes
		.reverse()
		.filter((s) => !!s)
		.join('/');
	if (prefix) {
		if (scope) {
			scope += '/' + prefix;
		} else {
			scope = prefix;
		}
	}

	return {
		name,
		scope,
	};
};

export const joinScopes = (...partial: (string | undefined)[]) => {
	return partial.filter((s) => !!s && s !== '.').join('/');
};

export type DiffEntry = [any, any];

export type DiffResults = {
	hasDiff: boolean;
	diffs: Record<string, DiffEntry>;
};

export type ValidationResult = {
	error?: string;
};

export type ValidationResultMap = {
	errors?: number;
	errorMap?: Record<string, ValidationResult>;
};

export type DiffValidator = (
	diff: DiffResults,
	data: any
) => ValidationResultMap;

export type PayloadDiffValidation = {
	diff: DiffResults;
	scope?: string;
	validationResults: ValidationResultMap;
};

export const computeArrayDiff = (oval: any[], nval: any[]): DiffResults => {
	const mydiff: DiffResults = {
		hasDiff: false,
		diffs: {},
	};

	const max = oval.length > nval.length ? oval.length : nval.length;
	let errs = 0;
	for (let i = 0; i < max; i++) {
		// null is an object!
		if (
			oval[i] &&
			typeof oval[i] === 'object' &&
			nval[i] &&
			typeof nval[i] === 'object'
		) {
			const _diff = computeDiff(oval[i], nval[i]);
			if (_diff.hasDiff) {
				mydiff.diffs[`[${i}]`] = [oval[i], nval[i]];
				errs++;
			}
		} else {
			if (oval[i] !== nval[i]) {
				mydiff.diffs[`[${i}]`] = [oval[i], nval[i]];
				errs++;
			}
		}
	}

	mydiff.hasDiff = !!errs;
	return mydiff;
};

const mergeArrays = (arr1: string[], arr2: string[]) => {
	const examined: any = {};
	for (const ele of arr1) {
		examined[ele] = true;
	}
	for (const ele of arr2) {
		examined[ele] = true;
	}
	return Object.keys(examined);
};

/**
 * Does a deep traverse between two objects to compute changes. Each diff
 * is registered as path.
 */
export const computeDiff = (
	oval: FHData,
	nval: FHData,
	curpath = '',
	diff?: DiffResults
): DiffResults => {
	const prefix = curpath ? curpath + '/' : '';
	const curdiff = diff ?? { hasDiff: false, diffs: {} };
	const examined: Record<string, boolean> = {};

	if (oval === null && nval === null) {
		return curdiff;
	}
	if (oval === null || nval === null) {
		curdiff.diffs[curpath] = [oval, nval];
		return curdiff;
	}

	for (const okey of mergeArrays(Object.keys(oval), Object.keys(nval))) {
		examined[okey] = true;
		const ov = oval[okey];
		const nv = nval[okey];
		if (ov instanceof Array && nv instanceof Array) {
			const arrdiff = computeArrayDiff(ov, nv);
			if (arrdiff.hasDiff) {
				curdiff.hasDiff = true;
				for (const index in arrdiff.diffs) {
					curdiff.diffs[prefix + okey + index] = arrdiff.diffs[index];
				}
			}
		} else if (typeof ov === 'object' && typeof nv === 'object') {
			computeDiff(ov, nv, prefix + okey, curdiff);
		} else if (ov !== nv) {
			curdiff.hasDiff = true;
			curdiff.diffs[prefix + okey] = [ov, nv];
		}
	}

	return curdiff;
};

/**
 * Standard handler for `input.onChange`.
 */
export const inputChanged = (
	input: HTMLInputElement,
	{ updateControlValue, getData }: FHContextProps
) => {
	if (input.dataset['fhignore']) {
		return;
	}
	const { scope, name } = getScopeAndName(input);
	switch (input.type) {
		case 'hidden':
		case 'text':
			updateControlValue({ scope, name, value: input.value });
			break;
		case 'radio':
			if (input.checked) {
				updateControlValue({ scope, name, value: input.value });
			}
			break;
		case 'checkbox':
			if (input.multiple) {
				updateControlValue({
					scope,
					name,
					value: input.value,
					isArray: true,
					isArrRemove: !input.checked,
				});
			} else {
				const isBool = !!input.dataset[DS_KEY_BOOL];
				if (isBool) {
					updateControlValue({
						scope,
						name,
						value: input.checked,
					});
				} else {
					if (input.checked) {
						updateControlValue({
							scope,
							name,
							value: input.value,
						});
					} else if (input.dataset[DS_KEY_VAL_UNCHECKED]) {
						updateControlValue({
							scope,
							name,
							value: input.dataset[DS_KEY_VAL_UNCHECKED],
						});
					} else {
						updateControlValue({
							scope,
							name,
							value: undefined,
						});
					}
				}
			}
			break;
	}
};

/**
 * Standard handler for `textarea.onChange`.
 */
export const textareaChanged = (
	textarea: HTMLTextAreaElement,
	{ updateControlValue, getData }: FHContextProps
) => {
	const { scope, name } = getScopeAndName(textarea as any);
	updateControlValue({ scope, name, value: textarea.value });
};

/**
 * Standard handler for `select.onChange`.
 */
export const selectChanged = (
	select: HTMLSelectElement,
	{ updateControlValue, getData }: FHContextProps
) => {
	const { scope, name } = getScopeAndName(select as any);
	if (select.multiple) {
		const vals: string[] = [];
		for (const opt of select.options) {
			if (opt.selected) {
				vals.push(opt.value);
			}
		}
		updateControlValue({ scope, name, value: vals });
	} else {
		updateControlValue({ scope, name, value: select.value });
	}
};
