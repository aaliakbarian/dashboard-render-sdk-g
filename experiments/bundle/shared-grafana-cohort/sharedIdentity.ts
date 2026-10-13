// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  PanelPlugin,
  Registry,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
} from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import {
  config,
  getBackendSrv,
  getDataSourceSrv,
  getPluginImportUtils,
  getRunRequest,
} from '@grafana/runtime';
import { SceneObjectBase, SceneQueryRunner } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { CacheProvider } from '@emotion/react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Observable, Subject } from 'rxjs';

export const SHARED_COHORT_IDENTITY = Object.freeze({
  CacheProvider,
  DashboardCursorSync,
  Observable,
  PanelPlugin,
  React,
  ReactDOM,
  Registry,
  SceneObjectBase,
  SceneQueryRunner,
  Subject,
  config,
  css,
  getBackendSrv,
  getDataSourceSrv,
  getPluginImportUtils,
  getRunRequest,
  initPluginTranslations,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
  useStyles2,
});

export type SharedCohortIdentity = typeof SHARED_COHORT_IDENTITY;
