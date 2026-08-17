// k6 load test script for Safaai Sarathi 2.0
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = { vus: 100, duration: '30s' };
export default function () {
  const res = http.get('https://safaaisarathi2-0.onrender.com/api/public/stats');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(0.1);
}
