export const sortString = (a?: string, b?: string) =>
	a === b
		? 0
		: a === undefined
		? -1
		: b === undefined
		? 1
		: a < b
		? -1
		: a > b
		? 1
		: 0;

export type EventBus<Events extends string> = {
	addListener: (
		name: Events,
		listener: (...args: any[]) => void
	) => () => void;
	emit: (name: Events, ...args: any[]) => void;
};

export function makeEventBus<Events extends string>(): EventBus<Events> {
	const handlerMap: Record<string, Function[]> = {};

	const emit = (name: string, ...args: any[]) => {
		if (!handlerMap[name]) return;
		handlerMap[name].forEach((fn) => {
			fn(...args);
		});
	};

	return {
		addListener: (name: Events, listener: (...args: any[]) => void) => {
			if (!handlerMap[name]) {
				handlerMap[name] = [];
			}

			handlerMap[name].push(listener);
			return () => {
				handlerMap[name] = handlerMap[name].filter(
					(fn) => fn !== listener
				);
			};
		},
		emit: (name: Events, ...args: any[]) => {
			emit(name, name, ...args);
			emit('*', name, ...args);
		},
	};
}

export const eventBus = makeEventBus();
