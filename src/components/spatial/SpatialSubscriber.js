import React, { useEffect, useMemo, useCallback } from 'react';
import TitleInfo from '../TitleInfo';
import { capitalize } from '../../utils';
import { useDeckCanvasSize, useReady, useUrls } from '../hooks';
import { setCellSelection, mergeCellSets } from '../utils';
import {
  useCellsData, useCellSetsData, useExpressionMatrixData,
  useMoleculesData, useNeighborhoodsData, useRasterData,
} from '../data-hooks';
import { getCellColors } from '../interpolate-colors';
import Spatial from './Spatial';
import SpatialOptions from './SpatialOptions';
import SpatialTooltipSubscriber from './SpatialTooltipSubscriber';
import { makeSpatialSubtitle } from './utils';
import {
  useCoordination,
  useLoaders,
  useSetComponentHover,
  useSetComponentViewInfo,
} from '../../app/state/hooks';
import { COMPONENT_COORDINATION_TYPES } from '../../app/state/coordination';

const SPATIAL_DATA_TYPES = [
  'cells', 'molecules', 'raster', 'cell-sets', 'expression-matrix',
];

/**
 * A subscriber component for the spatial plot.
 * @param {object} props
 * @param {string} props.theme The current theme name.
 * @param {object} props.coordinationScopes The mapping from coordination types to coordination
 * scopes.
 * @param {function} props.removeGridComponent The callback function to pass to TitleInfo,
 * to call when the component has been removed from the grid.
 * @param {boolean} props.initializeSpatialRasterLayers Should the coordination
 * value be automatically initialized based on the data?
 * @param {boolean} props.initializeSpatialCellsLayers Should the coordination
 * value be automatically initialized based on the data?
 * @param {boolean} props.initializeSpatialMoleculesLayers Should the coordination
 * value be automatically initialized based on the data?
 * @param {boolean} props.initializeSpatialNeighborhoodsLayers Should the coordination
 * value be automatically initialized based on the data?
 * @param {boolean} props.initializeCellSetSelection Should the coordination
 * value be automatically initialized based on the data?
 * @param {boolean} props.initializeCellSetColor Should the coordination
 * value be automatically initialized based on the data?
 * @param {string} props.title The component title.
 */
export default function SpatialSubscriber(props) {
  const {
    uuid,
    coordinationScopes,
    removeGridComponent,
    observationsLabelOverride: observationsLabel = 'cell',
    observationsPluralLabelOverride: observationsPluralLabel = `${observationsLabel}s`,
    subobservationsLabelOverride: subobservationsLabel = 'molecule',
    subobservationsPluralLabelOverride: subobservationsPluralLabel = `${subobservationsLabel}s`,
    theme,
    disableTooltip = false,
    initializeSpatialCellsLayers = true,
    initializeSpatialMoleculesLayers = true,
    initializeSpatialNeighborhoodsLayers = true,
    initializeSpatialRasterLayers = true,
    initializeCellSetSelection = true,
    initializeCellSetColor = true,
    title = 'Spatial',
  } = props;

  const loaders = useLoaders();
  const setComponentHover = useSetComponentHover();
  const setComponentViewInfo = useSetComponentViewInfo(uuid);

  // Get "props" from the coordination space.
  const [{
    dataset,
    spatialZoom: zoom,
    spatialTargetX: targetX,
    spatialTargetY: targetY,
    spatialTargetZ: targetZ,
    spatialRasterLayers: rasterLayers,
    spatialCellsLayers: cellsLayers,
    spatialMoleculesLayers: moleculesLayers,
    spatialNeighborhoodsLayers: neighborhoodsLayers,
    cellFilter,
    cellHighlight,
    geneSelection,
    cellSetSelection,
    cellSetColor,
    cellColorEncoding,
    additionalCellSets,
  }, {
    setSpatialZoom: setZoom,
    setSpatialTargetX: setTargetX,
    setSpatialTargetY: setTargetY,
    setSpatialTargetZ: setTargetZ,
    setSpatialRasterLayers: setRasterLayers,
    setSpatialCellsLayers: setCellsLayers,
    setSpatialMoleculesLayers: setMoleculesLayers,
    setSpatialNeighborhoodsLayers: setNeighborhoodsLayers,
    setCellFilter,
    setCellSetSelection,
    setCellHighlight,
    setCellSetColor,
    setCellColorEncoding,
    setAdditionalCellSets,
    setMoleculeHighlight,
  }] = useCoordination(COMPONENT_COORDINATION_TYPES.spatial, coordinationScopes);

  const [urls, addUrl, resetUrls] = useUrls();
  const [isReady, setItemIsReady, resetReadyItems] = useReady(
    SPATIAL_DATA_TYPES,
  );
  const [width, height, deckRef] = useDeckCanvasSize();

  // Reset file URLs and loader progress when the dataset has changed.
  // Also clear the array of automatically-initialized layers.
  useEffect(() => {
    resetUrls();
    resetReadyItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaders, dataset]);

  // Get data from loaders using the data hooks.
  const [cells, cellsCount] = useCellsData(
    loaders, dataset, setItemIsReady, addUrl, false,
    { setSpatialCellsLayers: setCellsLayers },
    { initializeSpatialCellsLayers },
  );
  const [molecules, moleculesCount, locationsCount] = useMoleculesData(
    loaders, dataset, setItemIsReady, addUrl, false,
    { setSpatialMoleculesLayers: setMoleculesLayers },
    { initializeSpatialMoleculesLayers },
  );
  const [neighborhoods] = useNeighborhoodsData(
    loaders, dataset, setItemIsReady, addUrl, false,
    { setSpatialNeighborhoodsLayers: setNeighborhoodsLayers },
    { initializeSpatialNeighborhoodsLayers },
  );
  const [cellSets] = useCellSetsData(
    loaders, dataset, setItemIsReady, addUrl, false,
    { setCellSetSelection, setCellSetColor },
    { initializeCellSetSelection, initializeCellSetColor },
  );
  const [expressionMatrix] = useExpressionMatrixData(
    loaders, dataset, setItemIsReady, addUrl, false,
  );
  // eslint-disable-next-line no-unused-vars
  const [raster, imageLayerLoaders] = useRasterData(
    loaders, dataset, setItemIsReady, addUrl, false,
    { setSpatialRasterLayers: setRasterLayers },
    { initializeSpatialRasterLayers },
  );

  const layers = useMemo(() => [
    ...(moleculesLayers ? moleculesLayers.map(l => ({ ...l, type: 'molecules' })) : []),
    ...(cellsLayers ? cellsLayers.map(l => ({ ...l, type: 'cells' })) : []),
    ...(neighborhoodsLayers
      ? neighborhoodsLayers.map(l => ({ ...l, type: 'neighborhoods' }))
      : []
    ),
    ...(rasterLayers ? rasterLayers.map(l => ({ ...l, type: 'raster' })) : []),
  ], [cellsLayers, moleculesLayers, neighborhoodsLayers, rasterLayers]);

  const mergedCellSets = useMemo(() => mergeCellSets(
    cellSets, additionalCellSets,
  ), [cellSets, additionalCellSets]);

  const setCellSelectionProp = useCallback((v) => {
    setCellSelection(
      v, additionalCellSets, cellSetColor,
      setCellSetSelection, setAdditionalCellSets, setCellSetColor,
      setCellColorEncoding,
    );
  }, [additionalCellSets, cellSetColor, setCellColorEncoding,
    setAdditionalCellSets, setCellSetColor, setCellSetSelection]);

  const cellColors = useMemo(() => getCellColors({
    cellColorEncoding,
    expressionMatrix,
    geneSelection,
    cellSets: mergedCellSets,
    cellSetSelection,
    cellSetColor,
  }), [cellColorEncoding, geneSelection, mergedCellSets,
    cellSetColor, cellSetSelection, expressionMatrix]);

  const cellSelection = useMemo(() => Array.from(cellColors.keys()), [cellColors]);

  const getCellInfo = (cellId) => {
    const cell = cells[cellId];
    if (cell) {
      return {
        [`${capitalize(observationsLabel)} ID`]: cellId,
        ...cell.factors,
      };
    }
    return null;
  };

  const subtitle = makeSpatialSubtitle({
    observationsCount: cellsCount,
    observationsLabel,
    observationsPluralLabel,
    subobservationsCount: moleculesCount,
    subobservationsLabel,
    subobservationsPluralLabel,
    locationsCount,
  });
  return (
    <TitleInfo
      title={title}
      info={subtitle}
      isSpatial
      urls={urls}
      theme={theme}
      removeGridComponent={removeGridComponent}
      isReady={isReady}
      options={(
        <SpatialOptions
          observationsLabel={observationsLabel}
          cellColorEncoding={cellColorEncoding}
          setCellColorEncoding={setCellColorEncoding}
        />
      )}
    >
      <Spatial
        ref={deckRef}
        uuid={uuid}
        width={width}
        height={height}
        viewState={{ zoom, target: [targetX, targetY, targetZ] }}
        setViewState={({ zoom: newZoom, target }) => {
          setZoom(newZoom);
          setTargetX(target[0]);
          setTargetY(target[1]);
          setTargetZ(target[2]);
        }}
        layers={layers}
        cells={cells}
        cellFilter={cellFilter}
        cellSelection={cellSelection}
        cellHighlight={cellHighlight}
        cellColors={cellColors}
        molecules={molecules}
        neighborhoods={neighborhoods}
        imageLayerLoaders={imageLayerLoaders}
        setCellFilter={setCellFilter}
        setCellSelection={setCellSelectionProp}
        setCellHighlight={setCellHighlight}
        setMoleculeHighlight={setMoleculeHighlight}
        setComponentHover={() => {
          setComponentHover(uuid);
        }}
        updateViewInfo={setComponentViewInfo}
      />
      {!disableTooltip && (
      <SpatialTooltipSubscriber
        parentUuid={uuid}
        cellHighlight={cellHighlight}
        width={width}
        height={height}
        getCellInfo={getCellInfo}
      />
      )}
    </TitleInfo>
  );
}
