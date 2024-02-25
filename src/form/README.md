# `formHelp`: possibly the best React form state management tool?

`formHelp` makes dynamic forms easy to build and natural to work with:

- fully managed control states
- completely native HTML interface: `FHinput -> input, FHtextarea -> textarea, FHselect -> select`
  - you can literally swap these in for their native counterparts and have a completely dynamic form
- ability to easily create non-standard controls using `FHContext` methods
- ability to create arbitrarily complex JSON structures through `data-fhscope` nesting
- opt-in to control updates at any level
- opt-in to control blurs at any level

As an example, let's model a basic user profile:

```json
{
	"firstName": "hen",
	"address": {
		"line1": "123 Street",
		"line2": ""
	}
}
```

Our first bit of code will look like this:

```jsx
First Name: <FHinput name="firstName" />
<br />
<div data-fhscope="address">
	Line 1: <FHinput name="line1" />
	<br />
	Line 2: <FHinput name="line2" />
</div>
```

Note that `data-fhscope="address"` surrounds `line1` and `line2`: this will group both lines under the `address` object. **Scopes can wrap other scopes to create deeper nestings.**

Now, let's do some basic integration using `FHContext` -- this provides complete access to form state management:

```jsx
const YourForm = () => {
	const profile = {
		firstName: 'hen',
		address: {
			line1: '123 Street',
			line2: '',
		},
	};
	const ctx = makeFHContext({
		data: profile,
	});
	const data = ctx.getData();
	return (
		<FHContext.Provider value={ctx}>
			First Name: <FHinput name="firstName" defaultValue={data.firstName} />
			<br />
			<div data-fhscope="address">
				Line 1: <FHinput name="line1" defaultValue={data.address.line1} />
				<br />
				Line 2: <FHinput name="line2" defaultValue={data.address.line2} />
			</div>
		</FHContext.Provider>
	);
};
```

When you run this, nothing special will happen. But now let's say we want to auto-save this form every time a change is made and a control loses focus:

```jsx
const YourForm = () => {
	const profile = {
		firstName: 'hen',
		address: {
			line1: '123 Street',
			line2: '',
		},
	};
	const ctx = makeFHContext({
		data: profile,
	});
	const data = ctx.getData();
	useEffect(() => ctx.bindToBlurredScope('*', () => {
			// the number of updates that have occurred since last save
			const changes = ctx.getChangelog().length;
			if (changes > 0) {
				// store data and clear changelog
				console.log('>> auto-save!', ctx.getData());
				ctx.clearChangelog();
			}
	}))
	return (
		<FHContext.Provider value={ctx}>
			First Name: <FHinput name="firstName" defaultValue={data.firstName} />
			<br />
			<div data-fhscope="address">
				Line 1: <FHinput name="line1" defaultValue={data.address.line1} />
				<br />
				Line 2: <FHinput name="line2" defaultValue={data.address.line2} />
			</div>
		</FHContext.Provider>
	);
};
```

You'll now see a log statement containing your form data whenever you make a change and tab to a new control.

> **You didn't have to manually set state at any point!** Imagine being able to build dynamic form elements for free, independent of each other, that automatically update the right part of the data structure!

Next, let's say we want to get notified when `line1` changes (before blur). Just add this hook:

```jsx
useEffect(() => {
	return ctx.bindToUpdatedScope(
		(args) => {
			console.log('address/line1: ', args);
		},
		// the full scope containing your control
		'address',
		// the  control name
		'line1'
	);
});
```

What if you want to get any updates to `address`?

```jsx
useEffect(() => {
	return ctx.bindToUpdatedScope(
		(args) => {
			console.log('address: ', args);
		},
		'address',
	);
});
```

What if you wanted to get any updates on the form?

```jsx
useEffect(() => {
	return ctx.bindScopedListener((evt, ...args) => {
		console.log('*: ', ...args);
	}, '*);
});
```

What if you wanted to subscribe to `line1` blurs?

```jsx
useEffect(() => {
	return ctx.bindToBlurredScope('address/line1', (args) => {
		console.log('blur address/line1: ', args);
	});
});
```

What if you wanted to subscribe to any `address` blurs?

```jsx
useEffect(() => {
	return ctx.bindToBlurredScope('address', (args) => {
		console.log('blur address: ', args);
	});
});
```

And as you saw earlier, you can subscribe to all blur events with `*`.

The rules don't change no matter where in the form you are, allowing you to build sections of your app in a granular and predictable way!

## Order of Events

- on-changes
- on-blurs

### Order of on-changes

Using a `DiffResult`, which may contain multiple control updates:

- scoped-update (`bindToUpdatedScope()`) on specific controls
  - e.g. `firstName, address/line1, contact/email/primary`
- scoped-update (`bindToUpdatedScope()`) on all unique ancestor scopes, from deepest to shallowest (excluding root)
  - e.g. `contact/email, contact, address`
- global-update (`events['updated']`) on all diffs

### Order of on-blurs

- scoped on specific control (`bindToBlurredScope()`)
- scoped on all ancestor paths excluding root (`bindToBlurredScope()`)
- context-defined blur for entire form

## Control Update Semantics

By default, all values are treated as strings. Special cases occur with `select/input[type="checkbox"]`.

## `<FHselect multiple/>`, `<FHinput type="checkbox" multiple/>`

Target value is a `string[]` where elements are pushed into or removed from

## `<FHinput type="checkbox" value="checked" {...getDataProps({valUnchecked: 'not-checked'})} />`

If this checkbox is unchecked, `not-checked` is used as the unchecked value, otherwise, `checked` is the value

## `<FHinput type="checkbox" {...getDataProps({bool: true})} />`

Stores a `boolean` instead of `string`
