import { useContext, useEffect, useState } from 'react';
import { FHContext } from './core';

export function useBindScopedUpdate<DataType = any>(scope: string) {
	const fhctx = useContext(FHContext);
	const [state, setState] = useState({} as DataType);
	useEffect(() =>
		fhctx.bindToUpdatedScope((scope, payload) => {
			// console.log('🚨', {scope, payload});
			setState(fhctx.getScopedData(scope));
		}, scope)
	);
	return state;
}

/**
 * Binds to a specifical control's blur and changes the state value to the current form value.
 * If `initialVal` is undefined, the runtime form value is used.
 */
export function useChangeScopedValOnBlur<ValType = any>(
	scope: string,
	name: string,
	initialVal?: ValType
) {
	const fhctx = useContext(FHContext);
	const [value, setValue] = useState(
		initialVal ?? fhctx.getScopedData(scope)[name]
	);
	useEffect(() =>
		fhctx.bindToBlurredScope(
			scope + '/' + name,
			(blurScope, evt, oScope) => {
				setValue(fhctx.getScopedData(scope)[name]);
			}
		)
	);
	return value;
}
