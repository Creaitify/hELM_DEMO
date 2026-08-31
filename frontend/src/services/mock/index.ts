/**
 * The sample workspace, in one import.
 *
 * Every fixture module is re-exported as-is; there is no logic here. It used
 * to also carry an adapter implementation, which is the note below.
 */

export * from './constants';
export * from './series';
export * from './campaigns';
export * from './scoreline';
export * from './intelligence';
export * from './library';
export * from './public-content';

/*
 * The HelmAdapter surface used to be re-implemented here as `mockAdapter`, and
 * exported as `adapter`.
 *
 * Nothing ever imported either. The sixteen frontend surfaces that read
 * fixtures import the typed data directly, and the live ones go through
 * services/http. An interface with one implementation and no callers is not a
 * seam — it is a second definition of the fixtures that had to be kept in step
 * by hand, and the real swap point turned out to be services/http/server.ts,
 * which is where live and fixture already diverge.
 */
