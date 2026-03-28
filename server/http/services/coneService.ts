import { APPROACH_CONE_27, RWY27_THRESHOLD } from '@/server/opensky/detector';

export function buildConeResponse() {
  return {
    cone27: APPROACH_CONE_27,
    threshold27: RWY27_THRESHOLD,
    cone: APPROACH_CONE_27,
    threshold: RWY27_THRESHOLD,
  };
}
