import { makeEventBus, sortString } from '../utils';
import type { DiffResults, FHContextProps } from './core';
import {
	computeDiff,
	defaultSubmitHandler,
	getDataByPath,
	joinScopes,
	jsonClone,
} from './core';

export const makeScopeCollector = () => {
	const qScopes: Record<string, boolean> = {};
	const addScope = (scope: string, name?: string) => {
		let path = '';
		const parts = joinScopes(scope, name)
			.split('/')
			.filter((s) => s && s !== '.');
		while (parts.length > 0) {
			const s = parts.join('/');
			qScopes[s] = true;
			parts.pop();
			// the fully resolved path of this scope/name will be set;
			// if name is defined, will inject `scope/*` after `scope/name`
			if (!path) {
				path = s;
				if (name) {
					qScopes[parts.join('/') + '/*'] = true;
				}
			} else if (s.match(/\[.*\]$/)) {
				const arrParent = s.replace(/\[.*\]$/, '') + '/*';
				qScopes[arrParent] = true;
			}
		}
		return path;
	};

	return {
		addScope,
		getScopes: () =>
			Object.keys(qScopes).sort((a, b) => {
				if (a.length < b.length) {
					return 1;
				} else if (a.length > b.length) {
					return -1;
				}
				return sortString(a, b);
			}),
	};
};

export const makeFHContext = (
	p: Partial<FHContextProps> & {
		onBlur?: React.FocusEventHandler<HTMLElement>;
	} = {}
): FHContextProps => {
	const data: any = jsonClone(p.data ?? {});
	const initialData = jsonClone(p.initialData ?? data);
	const ref = { data, initialData, changelog: [] as DiffResults[] };
	const events: FHContextProps['events'] = makeEventBus();
	const scopedUpdateBus = makeEventBus();
	const scopedBlurBus = makeEventBus();

	const triggerUpdate = (diff: DiffResults) => {
		if (!diff.hasDiff) {
			return;
		}

		const clone = jsonClone(ref.data);
		ref.changelog.push(diff);
		const scopeColl = makeScopeCollector();
		for (const [path, valDiff] of Object.entries(diff.diffs)) {
			const parts = path.split('/');
			const name = parts.pop();
			const scope = parts.join('/');

			scopedUpdateBus.emit(path, { path, scope, name, valDiff });
			if (scope !== '' && scope !== '.') {
				scopeColl.addScope(scope);
			}
		}

		for (const scope of scopeColl.getScopes()) {
			scopedUpdateBus.emit(scope, { scope, diff });
		}

		scopedUpdateBus.emit('*', diff, clone);
	};

	const bindToUpdatedScope: FHContextProps['bindToUpdatedScope'] = (
		handler,
		scope = '.',
		name
	) => {
		if (scope && scope !== '.') {
			if (name) {
				return scopedUpdateBus.addListener(`${scope}/${name}`, handler);
			} else {
				return scopedUpdateBus.addListener(scope, handler);
			}
		}

		return () => {};
	};

	const bindToBlurredScope: FHContextProps['bindToBlurredScope'] = (
		path,
		handler
	) => {
		if (!path) {
			return () => {};
		}
		return scopedBlurBus.addListener(path, handler);
	};

	const update: FHContextProps['setControlValue'] = (
		name,
		val,
		scope = '.'
	) => {
		const odata = jsonClone(ref.data);
		getDataByPath(ref.data, scope, (ptr) => {
			ptr[name] = val;
		});
		triggerUpdate(computeDiff(odata, ref.data, scope));
	};

	const updateControlValue: FHContextProps['updateControlValue'] = ({
		scope,
		name,
		value,
		isArray,
		isArrRemove,
	}) => {
		const odata = jsonClone(data);
		if (value === undefined) {
			getDataByPath(data, scope, (ptr) => {
				delete ptr[name];
			});
			triggerUpdate(computeDiff(odata, data, scope));
			return;
		}

		getDataByPath(data, scope, (ptr) => {
			if (isArray) {
				if (!ptr[name]) {
					ptr[name] = [];
				}
				if (isArrRemove) {
					ptr[name] = ptr[name].filter((v: string) => v !== value);
				} else {
					ptr[name].push(value);
				}
			} else {
				ptr[name] = value;
			}
		});

		triggerUpdate(computeDiff(odata, data));
	};

	const getScopedData: FHContextProps['getScopedData'] = (scope) =>
		getDataByPath(ref.data, scope);

	const submit = p.submit ?? defaultSubmitHandler;

	const blur: FHContextProps['blur'] = (
		scope,
		nameOrEvt,
		optEvt?: React.FocusEvent<HTMLElement>
	) => {
		let name = '';
		let evt: null | React.FocusEvent<HTMLElement> = null;
		if (typeof nameOrEvt === 'string') {
			name = nameOrEvt;
			if (optEvt) {
				evt = optEvt;
			}
		} else if (nameOrEvt) {
			evt = nameOrEvt;
		}

		const scopeColl = makeScopeCollector();
		const path = scopeColl.addScope(scope, name);
		let qscopes: string[] = scopeColl.getScopes();

		for (const s of qscopes) {
			if (evt?.isPropagationStopped?.()) {
				// console.log('blur STOPPED');
				break;
			}
			// console.log('blur ', s);
			scopedBlurBus.emit(s, evt, path);
		}

		if (!evt?.isPropagationStopped?.()) {
			// console.log('blur ', '*');
			scopedBlurBus.emit('*', evt, scope);
		}
	};

	return {
		data,
		getChangelog: () => [...ref.changelog],
		clearChangelog: () => {
			const old = ref.changelog;
			ref.changelog = [];
			return old;
		},
		getData: () => ({ ...ref.data }),
		getInitial: () => ({ ...ref.initialData }),
		getScopedData,
		setData: (newData, scope = '.') => {
			getDataByPath(ref.data, scope, (ptr) => {
				const optr = jsonClone(ptr);
				Object.assign(ptr, newData);
				const diff = computeDiff(optr, ptr, scope);
				triggerUpdate(diff);
			});
		},
		setInitial: (newData, scope = '.') => {
			getDataByPath(ref.initialData, scope, (ptr) => {
				const optr = jsonClone(ptr);
				const diff = computeDiff(optr, ptr, scope);
				events.emit('set-initial', { diff, scope });
			});
		},
		initialData,
		events,
		blur,
		bindToBlurredScope,
		bindToUpdatedScope,
		reset: () => {
			ref.data = jsonClone(ref.initialData);
			events.emit('reset', jsonClone(ref.data));
		},
		resetControl: (name, scope = '.') => {
			getDataByPath(ref.data, scope, (ptr) => {
				const odata = jsonClone(ref.data);
				ptr[name] = getDataByPath(ref.initialData, scope)[name];
				triggerUpdate(computeDiff(odata, data));
			});
		},
		setControlValue: update,
		updateControlValue,
		submit,
		create: async (scope = '.', params = {}) => {
			return submit(getScopedData(scope), { method: 'POST', ...params });
		},
		update: async (scope = '.', params = {}) => {
			return submit(getScopedData(scope), { method: 'PUT', ...params });
		},
		delete: async (scope = '.', params = {}) => {
			return submit(getScopedData(scope), {
				method: 'DELETE',
				...params,
			});
		},
	};
};
