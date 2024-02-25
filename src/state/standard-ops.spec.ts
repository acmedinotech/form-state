import type { StandardOpsActionMeta } from './core';
import { ActionStoreImpl, standardOpsReducer } from './core';

describe('action-store/standard-ops', () => {
	const store = new ActionStoreImpl<any, StandardOpsActionMeta>(
		{
			a: 'one',
			b: 'two',
			c: 3,
			d: 4,
		},
		{ reducers: [standardOpsReducer] }
	);

	let __innerEvents: string[] = [];
	store.listenFor('action:std-ops:change', (evt, { action, state, meta }) => {
		__innerEvents = meta?.innerEvents ?? [];
	});
	beforeEach(() => {
		__innerEvents = [];
	});

	it('applies `append` to .', () => {
		store.dispatchStdOps({
			append: {
				a: 'new-a',
				e: 'five',
			},
		});
		expect(store.getState()).toEqual({
			a: 'one',
			b: 'two',
			c: 3,
			d: 4,
			e: 'five',
		});
		expect(__innerEvents.slice(0, 1)).toEqual(['std-ops:change:.:e']);
	});

	it('applies `set` to .', () => {
		store.dispatchStdOps({
			set: {
				a: {
					deep: true,
				},
			},
		});
		expect(store.getState().a).toEqual({
			deep: true,
		});
		expect(__innerEvents.slice(0, 2)).toEqual([
			'std-ops:change:.:a',
			'std-ops:change:.',
		]);
	});

	it('applies `set` to a', () => {
		store.dispatchStdOps({
			path: 'a',
			set: {
				deep: false,
				newKey: true,
			},
		});
		expect(store.getState().a).toEqual({ deep: false, newKey: true });
		expect(__innerEvents.slice(0, 3)).toEqual([
			'std-ops:change:a:deep',
			'std-ops:change:a:newKey',
			'std-ops:change:a',
		]);
	});

	it('applies `remove` to .', () => {
		store.dispatchStdOps({
			remove: ['b'],
		});
		expect(store.getState().b).toEqual(undefined);
		expect(__innerEvents.slice(0, 2)).toEqual([
			'std-ops:change:.:b',
			'std-ops:change:.',
		]);
	});

	it('applies `remove` to a', () => {
		store.dispatchStdOps({
			path: 'a',
			remove: ['deep'],
		});
		expect(store.getState().a).toEqual({ newKey: true });
		expect(__innerEvents.slice(0, 2)).toEqual([
			'std-ops:change:a:deep',
			'std-ops:change:a',
		]);
	});

	it('applies `customOp` to .', () => {
		store.dispatchStdOps({
			customOp: (action, subgraph) => {
				return {
					c: undefined,
					f: 'is-new',
				};
			},
			remove: ['e'],
		});
		expect(__innerEvents.slice(0, 3)).toEqual([
			'std-ops:change:.:c',
			'std-ops:change:.:f',
			'std-ops:change:.',
		]);
	});
});
