/**
 * Provides various convenience functions and components:
 *
 * - FHinput, FHtextarea, FHselect: 100% fully compatible with corresponding native tags.
 *   Automatically binds to `onChange` and updates underlying form data.
 */
import React, { useContext } from 'react';
import {
	FHContext,
	getScopeAndName,
	inputChanged,
	selectChanged,
	textareaChanged,
} from './core';

export const FHinput = React.forwardRef<HTMLInputElement>(function MyInput(
	props: React.HTMLProps<HTMLInputElement>,
	ref
) {
	const ctx = useContext(FHContext);
	return (
		<input
			{...props}
			ref={ref}
			onChange={(e) => {
				inputChanged(e.currentTarget, ctx);
				props.onChange?.(e);
			}}
			onBlur={(e) => {
				props.onBlur?.(e);
				const { scope, name } = getScopeAndName(e.currentTarget);
				ctx.blur(scope, name, e);
			}}
			onClick={
				props.type === 'checkbox' || props.type === 'radio'
					? (e) => {
							// @bug: un-checking doesn't fire on-change
							inputChanged(e.currentTarget, ctx);
							e.currentTarget.blur();
					  }
					: undefined
			}
		/>
	);
});

export const FHtextarea = React.forwardRef<HTMLTextAreaElement>(
	function MyTextarea(props: React.HTMLProps<HTMLTextAreaElement>, ref) {
		const ctx = useContext(FHContext);
		return (
			<textarea
				{...props}
				ref={ref}
				onChange={(e) => {
					textareaChanged(e.currentTarget, ctx);
					props.onChange?.(e);
				}}
				onBlur={(e) => {
					props.onBlur?.(e);
					const { scope, name } = getScopeAndName(e.currentTarget);
					ctx.blur(scope, name, e);
				}}
			/>
		);
	}
);

export const FHselect = React.forwardRef<HTMLSelectElement>(function MySelect(
	props: React.HTMLProps<HTMLSelectElement>,
	ref
) {
	const ctx = useContext(FHContext);
	return (
		<select
			{...props}
			ref={ref}
			onChange={(e) => {
				selectChanged(e.currentTarget, ctx);
				props.onChange?.(e);
			}}
			onBlur={(e) => {
				props.onBlur?.(e);
				const { scope, name } = getScopeAndName(e.currentTarget);
				ctx.blur(scope, name, e);
			}}
		/>
	);
});
