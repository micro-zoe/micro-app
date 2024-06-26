import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from './pages/home.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home,
  },
  {
    path: '/page2',
    name: 'page2',
    component: () => import(/* webpackChunkName: "page2" */ './pages/page2.vue'),
  },
  {
    path: '/table',
    name: 'table',
    component: () => import(/* webpackChunkName: "table" */ './pages/table.vue'),
  },
  {
    path: '/nest',
    name: 'nest',
    component: () => import(/* webpackChunkName: "nest" */ './pages/nest.vue'),
  },
];

export default routes;
