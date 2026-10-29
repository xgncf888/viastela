/**
 * Test-only import order seam. The loading tests import this before installing
 * a DOM shim, so react-native-web decides it cannot use the DOM and keeps its
 * style sheet in memory.
 */
export { Animated, Platform, StyleSheet } from 'react-native';
