chunk-JQLEGPKR.js?v=3463d487:3258 Uncaught Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
    at getRootForUpdatedFiber (chunk-JQLEGPKR.js?v=3463d487:3258:128)
    at enqueueConcurrentRenderForLane (chunk-JQLEGPKR.js?v=3463d487:3246:16)
    at forceStoreRerender (chunk-JQLEGPKR.js?v=3463d487:5836:21)
    at updateStoreInstance (chunk-JQLEGPKR.js?v=3463d487:5818:41)
    at Object.react_stack_bottom_frame (chunk-JQLEGPKR.js?v=3463d487:18299:20)
    at runWithFiberInDEV (chunk-JQLEGPKR.js?v=3463d487:729:72)
    at commitHookEffectListMount (chunk-JQLEGPKR.js?v=3463d487:9143:163)
    at commitHookPassiveMountEffects (chunk-JQLEGPKR.js?v=3463d487:9197:60)
    at commitPassiveMountOnFiber (chunk-JQLEGPKR.js?v=3463d487:10772:29)
    at recursivelyTraversePassiveMountEffects (chunk-JQLEGPKR.js?v=3463d487:10742:13)
chunk-JQLEGPKR.js?v=3463d487:6698 An error occurred in the <ExtrasAggregator> component.

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.
