# UI Animation Guidelines (Reanimated)

When implementing or modifying animations and layout transitions in this project, adhere to the following standards established for a premium, snappy feel using `react-native-reanimated`:

## 1. Physics Configuration (Snappy, No Wobble)
For spring animations (`withSpring`, `LinearTransition.springify()`), always use a high-tension configuration to ensure crisp, instantaneous movement without lingering bounce:
- **Default Spring**: `{ damping: 50, stiffness: 350 }`
- **Fade Durations**: Keep fade-ins/fade-outs tight to match layout speed, generally `duration(150)` to `duration(200)`.

## 2. Preventing Text Distortion on Resize
Do NOT use `LinearTransition` on a parent container if it causes inner text to squish or stretch horizontally during expansion.
- **Instead**: Manually animate the `flex` or `width` percentage property using `useAnimatedStyle`. This forces the Flexbox engine to natively recalculate the bounds frame-by-frame, allowing text to seamlessly glide and re-center without applying a CSS scale transform.

## 3. Modal Lifecycle & Reanimated Conflicts
React Native's native `<Modal>` conflicts with Reanimated layout transitions. Use these established workarounds:
- **Preventing Initial Mount Jumps**: Delay attaching `LinearTransition` to an inner component until *after* the modal has naturally slid up. Use an `isAnimationReady` boolean state delayed by a `setTimeout` (approx 300-350ms) to prevent Reanimated from springing the initial `0x0 -> Intrinsic Size` layout calculation.
- **Smooth Exiting Animations**: If a custom exit animation (e.g., `SlideOutDown` + `FadeOut`) is required, do NOT rely on the parent component to instantly set `visible={false}` on the `<Modal>`. 
  - Set the Native Modal to `animationType="none"`.
  - Wrap the inner content with `<Animated.View exiting={...}>`.
  - Maintain an `internalVisible` state. When the prop `visible` becomes `false`, use a `setTimeout` (e.g., 300ms) to delay setting `internalVisible=false` to give Reanimated time to physically render the exit sequence before React Native destroys the view tree.
