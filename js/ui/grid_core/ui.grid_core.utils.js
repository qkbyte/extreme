import { getHeight } from '../../core/utils/size';
import $ from '../../core/renderer';
import { isDefined, isFunction, isString } from '../../core/utils/type';
import { when, Deferred } from '../../core/utils/deferred';
import sharedFiltering from '../shared/filtering';
import { format } from '../../core/utils/string';
import { each } from '../../core/utils/iterator';
import { extend } from '../../core/utils/extend';
import { getBoundingRect } from '../../core/utils/position';
import { toComparable } from '../../core/utils/data';
import { equalByValue } from '../../core/utils/common';
import LoadPanel from '../load_panel';
import { normalizeSortingInfo as normalizeSortingInfoUtility } from '../../data/utils';
import formatHelper from '../../format_helper';
import { getWindow } from '../../core/utils/window';
import eventsEngine from '../../events/core/events_engine';
import { DataSource } from '../../data/data_source/data_source';
import ArrayStore from '../../data/array_store';
import { normalizeDataSourceOptions } from '../../data/data_source/utils';
import variableWrapper from '../../core/utils/variable_wrapper';

const DATAGRID_SELECTION_DISABLED_CLASS = 'dx-selection-disabled';
const DATAGRID_GROUP_OPENED_CLASS = 'dx-datagrid-group-opened';
const DATAGRID_GROUP_CLOSED_CLASS = 'dx-datagrid-group-closed';
const DATAGRID_EXPAND_CLASS = 'dx-datagrid-expand';
const NO_DATA_CLASS = 'nodata';
const SCROLLING_MODE_INFINITE = 'infinite';
const SCROLLING_MODE_VIRTUAL = 'virtual';
const LEGACY_SCROLLING_MODE = 'scrolling.legacyMode';
const SCROLLING_MODE_OPTION = 'scrolling.mode';
const ROW_RENDERING_MODE_OPTION = 'scrolling.rowRenderingMode';
const DATE_INTERVAL_SELECTORS = {
    'year': function(value) {
        return value && value.getFullYear();
    },
    'month': function(value) {
        return value && (value.getMonth() + 1);
    },
    'day': function(value) {
        return value && value.getDate();
    },
    'quarter': function(value) {
        return value && (Math.floor(value.getMonth() / 3) + 1);
    },
    'hour': function(value) {
        return value && value.getHours();
    },
    'minute': function(value) {
        return value && value.getMinutes();
    },
    'second': function(value) {
        return value && value.getSeconds();
    }
};

const getIntervalSelector = function() {
    const data = arguments[1];
    const value = this.calculateCellValue(data);

    if(!isDefined(value)) {
        return null;
    } else if(isDateType(this.dataType)) {
        const nameIntervalSelector = arguments[0];
        return DATE_INTERVAL_SELECTORS[nameIntervalSelector](value);
    } else if(this.dataType === 'number') {
        const groupInterval = arguments[0];
        return Math.floor(Number(value) / groupInterval) * groupInterval;
    }
};

const equalSelectors = function(selector1, selector2) {
    if(isFunction(selector1) && isFunction(selector2)) {
        if(selector1.originalCallback && selector2.originalCallback) {
            return selector1.originalCallback === selector2.originalCallback && selector1.columnIndex === selector2.columnIndex;
        }
    }

    return selector1 === selector2;
};

function isDateType(dataType) {
    return dataType === 'date' || dataType === 'datetime';
}

const setEmptyText = function($container) {
    $container.get(0).textContent = '\u00A0';
};

const normalizeSortingInfo = function(sort) {
    sort = sort || [];
    const result = normalizeSortingInfoUtility(sort);

    for(let i = 0; i < sort.length; i++) {
        if(sort && sort[i] && sort[i].isExpanded !== undefined) {
            result[i].isExpanded = sort[i].isExpanded;
        }
        if(sort && sort[i] && sort[i].groupInterval !== undefined) {
            result[i].groupInterval = sort[i].groupInterval;
        }
    }
    return result;
};

const formatValue = function(value, options) {
    const valueText = formatHelper.format(value, options.format) || (value && value.toString()) || '';
    const formatObject = {
        value: value,
        valueText: options.getDisplayFormat ? options.getDisplayFormat(valueText) : valueText,
        target: options.target || 'row',
        groupInterval: options.groupInterval
    };

    return options.customizeText ? options.customizeText.call(options, formatObject) : formatObject.valueText;
};

const getSummaryText = function(summaryItem, summaryTexts) {
    const displayFormat = summaryItem.displayFormat || (summaryItem.columnCaption && summaryTexts[summaryItem.summaryType + 'OtherColumn']) || summaryTexts[summaryItem.summaryType];

    return formatValue(summaryItem.value, {
        format: summaryItem.valueFormat,
        getDisplayFormat: function(valueText) {
            return displayFormat ? format(displayFormat, valueText, summaryItem.columnCaption) : valueText;
        },
        customizeText: summaryItem.customizeText
    });
};

const getWidgetInstance = function($element) {
    const editorData = $element.data && $element.data();
    const dxComponents = editorData && editorData.dxComponents;
    const widgetName = dxComponents && dxComponents[0];

    return widgetName && editorData[widgetName];
};

const equalFilterParameters = function(filter1, filter2) {
    if(Array.isArray(filter1) && Array.isArray(filter2)) {
        if(filter1.length !== filter2.length) {
            return false;
        } else {
            for(let i = 0; i < filter1.length; i++) {
                if(!equalFilterParameters(filter1[i], filter2[i])) {
                    return false;
                }
            }
        }
        return true;
    } else if(isFunction(filter1) && filter1.columnIndex >= 0 && isFunction(filter2) && filter2.columnIndex >= 0) {
        return filter1.columnIndex === filter2.columnIndex && toComparable(filter1.filterValue) === toComparable(filter2.filterValue);
    } else {
        return toComparable(filter1) == toComparable(filter2); // eslint-disable-line eqeqeq
    }
};

function normalizeGroupingLoadOptions(group) {
    if(!Array.isArray(group)) {
        group = [group];
    }

    return group.map((item, i) => {
        if(isString(item)) {
            return {
                selector: item,
                isExpanded: i < group.length - 1,
            };
        }

        return item;
    });
}

export default {
    renderNoDataText: function($element) {
        const that = this;
        $element = $element || this.element();

        if(!$element) {
            return;
        }

        const noDataClass = that.addWidgetPrefix(NO_DATA_CLASS);
        let noDataElement = $element.find('.' + noDataClass).last();
        const isVisible = this._dataController.isEmpty();
        const isLoading = this._dataController.isLoading();

        if(!noDataElement.length) {
            noDataElement = $('<span>')
                .addClass(noDataClass)
                .appendTo($element);
        }

        if(isVisible && !isLoading) {
            noDataElement
                .removeClass('dx-hidden')
                .text(that._getNoDataText());
        } else {
            noDataElement
                .addClass('dx-hidden');
        }
    },

    renderLoadPanel: function($element, $container, isLocalStore) {
        const that = this;
        let loadPanelOptions;

        that._loadPanel && that._loadPanel.$element().remove();
        loadPanelOptions = that.option('loadPanel');

        if(loadPanelOptions && (loadPanelOptions.enabled === 'auto' ? !isLocalStore : loadPanelOptions.enabled)) {
            loadPanelOptions = extend({
                shading: false,
                message: loadPanelOptions.text,
                container: $container
            }, loadPanelOptions);

            that._loadPanel = that._createComponent($('<div>').appendTo($container), LoadPanel, loadPanelOptions);
        } else {
            that._loadPanel = null;
        }
    },

    calculateLoadPanelPosition($element) {
        const $window = $(getWindow());
        if(getHeight($element) > getHeight($window)) {
            return {
                of: $window,
                boundary: $element,
                collision: 'fit'
            };
        }
        return { of: $element };
    },

    getIndexByKey: function(key, items, keyName) {
        let index = -1;

        if(key !== undefined && Array.isArray(items)) {
            keyName = arguments.length <= 2 ? 'key' : keyName;
            for(let i = 0; i < items.length; i++) {
                const item = isDefined(keyName) ? items[i][keyName] : items[i];

                if(equalByValue(key, item)) {
                    index = i;
                    break;
                }
            }
        }

        return index;
    },

    combineFilters: function(filters, operation) {
        let resultFilter = [];

        operation = operation || 'and';

        for(let i = 0; i < filters.length; i++) {
            if(!filters[i]) {
                continue;
            }
            if(filters[i]?.length === 1 && filters[i][0] === '!') {
                if(operation === 'and') {
                    return ['!'];
                } else if(operation === 'or') {
                    continue;
                }
            }
            if(resultFilter.length) {
                resultFilter.push(operation);
            }
            resultFilter.push(filters[i]);
        }
        if(resultFilter.length === 1) {
            resultFilter = resultFilter[0];
        }
        if(resultFilter.length) {
            return resultFilter;
        }
    },

    checkChanges: function(changes, changeNames) {
        let changesWithChangeNamesCount = 0;

        for(let i = 0; i < changeNames.length; i++) {
            if(changes[changeNames[i]]) {
                changesWithChangeNamesCount++;
            }
        }

        return changes.length && changes.length === changesWithChangeNamesCount;
    },

    equalFilterParameters: equalFilterParameters,

    proxyMethod: function(instance, methodName, defaultResult) {
        if(!instance[methodName]) {
            instance[methodName] = function() {
                const dataSource = this._dataSource;
                return dataSource ? dataSource[methodName].apply(dataSource, arguments) : defaultResult;
            };
        }
    },

    formatValue: formatValue,

    getFormatOptionsByColumn: function(column, target) {
        return {
            format: column.format,
            getDisplayFormat: column.getDisplayFormat,
            customizeText: column.customizeText,
            target: target,
            trueText: column.trueText,
            falseText: column.falseText
        };
    },

    getDisplayValue: function(column, value, data, rowType) {
        if(column.displayValueMap && column.displayValueMap[value] !== undefined) {
            return column.displayValueMap[value];
        } else if(column.calculateDisplayValue && data && rowType !== 'group') {
            return column.calculateDisplayValue(data);
        } else if(column.lookup && !(rowType === 'group' && (column.calculateGroupValue || column.calculateDisplayValue))) {
            return column.lookup.calculateCellValue(value);
        }
        return value;
    },

    getGroupRowSummaryText: function(summaryItems, summaryTexts) {
        let result = '(';

        for(let i = 0; i < summaryItems.length; i++) {
            const summaryItem = summaryItems[i];
            result += (i > 0 ? ', ' : '') + getSummaryText(summaryItem, summaryTexts);
        }
        return result += ')';
    },

    getSummaryText: getSummaryText,

    normalizeSortingInfo: normalizeSortingInfo,

    getFormatByDataType: function(dataType) {
        switch(dataType) {
            case 'date':
                return 'shortDate';
            case 'datetime':
                return 'shortDateShortTime';
        }
    },

    getHeaderFilterGroupParameters: function(column, remoteGrouping) {
        let result = [];
        const dataField = column.dataField || column.name;
        const groupInterval = sharedFiltering.getGroupInterval(column);

        if(groupInterval) {
            each(groupInterval, function(index, interval) {
                result.push(remoteGrouping ? { selector: dataField, groupInterval: interval, isExpanded: index < groupInterval.length - 1 } : getIntervalSelector.bind(column, interval));
            });

            return result;
        }

        if(remoteGrouping) {
            result = [{ selector: dataField, isExpanded: false }];
        } else {
            result = function(data) {
                let result = column.calculateCellValue(data);
                if(result === undefined || result === '') {
                    result = null;
                }
                return result;
            };

            if(column.sortingMethod) {
                result = [{ selector: result, compare: column.sortingMethod.bind(column) }];
            }
        }

        return result;
    },

    equalSortParameters(sortParameters1, sortParameters2, ignoreIsExpanded) {

        sortParameters1 = normalizeSortingInfo(sortParameters1);
        sortParameters2 = normalizeSortingInfo(sortParameters2);

        if(Array.isArray(sortParameters1) && Array.isArray(sortParameters2)) {
            if(sortParameters1.length !== sortParameters2.length) {
                return false;
            } else {
                for(let i = 0; i < sortParameters1.length; i++) {
                    if(!equalSelectors(sortParameters1[i].selector, sortParameters2[i].selector) || sortParameters1[i].desc !== sortParameters2[i].desc || sortParameters1[i].groupInterval !== sortParameters2[i].groupInterval || (!ignoreIsExpanded && Boolean(sortParameters1[i].isExpanded) !== Boolean(sortParameters2[i].isExpanded))) {
                        return false;
                    }
                }
            }
            return true;
        } else {
            return (!sortParameters1 || !sortParameters1.length) === (!sortParameters2 || !sortParameters2.length);
        }
    },

    getPointsByColumns: function(items, pointCreated, isVertical, startColumnIndex) {
        const cellsLength = items.length;
        let notCreatePoint = false;
        let item;
        let offset;
        let columnIndex = startColumnIndex || 0;
        const result = [];
        let rtlEnabled;

        for(let i = 0; i <= cellsLength; i++) {
            if(i < cellsLength) {
                item = items.eq(i);
                offset = item.offset();
                rtlEnabled = item.css('direction') === 'rtl';
            }

            const point = {
                index: columnIndex,
                x: offset ? offset.left + ((!isVertical && (rtlEnabled ^ (i === cellsLength))) ? getBoundingRect(item[0]).width : 0) : 0,
                y: offset ? offset.top + ((isVertical && i === cellsLength) ? getBoundingRect(item[0]).height : 0) : 0,
                columnIndex: columnIndex
            };

            if(!isVertical && i > 0) {
                const prevItemOffset = items.eq(i - 1).offset();

                if(prevItemOffset.top < point.y) {
                    point.y = prevItemOffset.top;
                }
            }

            if(pointCreated) {
                notCreatePoint = pointCreated(point);
            }

            if(!notCreatePoint) {
                result.push(point);
            }
            columnIndex++;
        }
        return result;
    },

    getExpandCellTemplate: function() {
        return {
            allowRenderToDetachedContainer: true,
            render: function(container, options) {
                const $container = $(container);

                if(isDefined(options.value) && !(options.data && options.data.isContinuation) && !options.row.isNewRow) {
                    const rowsView = options.component.getView('rowsView');
                    $container
                        .addClass(DATAGRID_EXPAND_CLASS)
                        .addClass(DATAGRID_SELECTION_DISABLED_CLASS);

                    $('<div>')
                        .addClass(options.value ? DATAGRID_GROUP_OPENED_CLASS : DATAGRID_GROUP_CLOSED_CLASS)
                        .appendTo($container);

                    rowsView.setAria('label', options.value ? rowsView.localize('dxDataGrid-ariaCollapse') : rowsView.localize('dxDataGrid-ariaExpand'), $container);
                } else {
                    setEmptyText($container);
                }
            }
        };
    },

    setEmptyText: setEmptyText,

    isDateType: isDateType,

    getSelectionRange: function(focusedElement) {
        try {
            if(focusedElement) {
                return {
                    selectionStart: focusedElement.selectionStart,
                    selectionEnd: focusedElement.selectionEnd
                };
            }
        } catch(e) { }

        return {};
    },

    setSelectionRange: function(focusedElement, selectionRange) {
        try {
            if(focusedElement && focusedElement.setSelectionRange) {
                focusedElement.setSelectionRange(selectionRange.selectionStart, selectionRange.selectionEnd);
            }
        } catch(e) { }
    },

    focusAndSelectElement: function(component, $element) {
        const isFocused = $element.is(':focus');

        eventsEngine.trigger($element, 'focus');

        const isSelectTextOnEditingStart = component.option('editing.selectTextOnEditStart');
        const element = $element.get(0);

        if(!isFocused && isSelectTextOnEditingStart && $element.is('.dx-texteditor-input') && !$element.is('[readonly]')) {
            const editor = getWidgetInstance($element.closest('.dx-texteditor'));

            when(editor && editor._loadItemDeferred).done(function() {
                element.select();
            });
        }
    },

    getWidgetInstance: getWidgetInstance,

    getLastResizableColumnIndex: function(columns, resultWidths) {
        const hasResizableColumns = columns.some(column => column && !column.command && !column.fixed && column.allowResizing !== false);
        let lastColumnIndex;

        for(lastColumnIndex = columns.length - 1; columns[lastColumnIndex]; lastColumnIndex--) {
            const column = columns[lastColumnIndex];
            const width = resultWidths && resultWidths[lastColumnIndex];
            const allowResizing = !hasResizableColumns || column.allowResizing !== false;

            if(!column.command && !column.fixed && width !== 'adaptiveHidden' && allowResizing) {
                break;
            }
        }

        return lastColumnIndex;
    },

    isElementInCurrentGrid: function(controller, $element) {
        if($element && $element.length) {
            const $grid = $element.closest('.' + controller.getWidgetContainerClass()).parent();
            return $grid.is(controller.component.$element());
        }
        return false;
    },

    isVirtualRowRendering: function(that) {
        const rowRenderingMode = that.option(ROW_RENDERING_MODE_OPTION);
        const isVirtualMode = that.option(SCROLLING_MODE_OPTION) === SCROLLING_MODE_VIRTUAL;
        const isAppendMode = that.option(SCROLLING_MODE_OPTION) === SCROLLING_MODE_INFINITE;

        if(that.option(LEGACY_SCROLLING_MODE) === false && (isVirtualMode || isAppendMode)) {
            return true;
        }

        return rowRenderingMode === SCROLLING_MODE_VIRTUAL;
    },

    getPixelRatio: function(window) {
        return window.devicePixelRatio || 1;
    },

    ///#DEBUG
    _setPixelRatioFn: function(value) {
        this.getPixelRatio = value;
    },
    ///#ENDDEBUG

    getContentHeightLimit(browser) {
        if(browser.mozilla) {
            return 8000000;
        }

        return 15000000 / this.getPixelRatio(getWindow());
    },

    normalizeLookupDataSource(lookup) {
        let lookupDataSourceOptions;
        if(lookup.items) {
            lookupDataSourceOptions = lookup.items;
        } else {
            lookupDataSourceOptions = lookup.dataSource;
            if(isFunction(lookupDataSourceOptions) && !variableWrapper.isWrapped(lookupDataSourceOptions)) {
                lookupDataSourceOptions = lookupDataSourceOptions({});
            }
        }

        return normalizeDataSourceOptions(lookupDataSourceOptions);
    },

    getWrappedLookupDataSource(column, dataSource, filter) {
        if(!dataSource) {
            return [];
        }

        const lookupDataSourceOptions = this.normalizeLookupDataSource(column.lookup);

        if(column.calculateCellValue !== column.defaultCalculateCellValue) {
            return lookupDataSourceOptions;
        }

        const hasGroupPaging = dataSource.remoteOperations().groupPaging;
        const hasLookupOptimization = column.displayField && isString(column.displayField);

        let cachedUniqueRelevantItems;
        const loadUniqueRelevantItems = (loadOptions) => {
            const group = normalizeGroupingLoadOptions(
                hasLookupOptimization ? [column.dataField, column.displayField] : column.dataField
            );
            const d = new Deferred();

            if(!hasGroupPaging && cachedUniqueRelevantItems) {
                d.resolve(cachedUniqueRelevantItems);
            } else {
                dataSource.load({
                    filter,
                    group,
                    take: hasGroupPaging ? loadOptions.take : undefined,
                    skip: hasGroupPaging ? loadOptions.skip : undefined,
                }).done((items) => {
                    cachedUniqueRelevantItems = items;
                    d.resolve(items);
                }).fail(d.fail);
            }

            return d;
        };

        const lookupDataSource = {
            ...lookupDataSourceOptions,
            load: (loadOptions) => {
                const d = new Deferred();
                loadUniqueRelevantItems(loadOptions).done((items) => {
                    if(items.length === 0) {
                        d.resolve([]);
                    }

                    let newDataSource;

                    if(hasLookupOptimization) {
                        const lookupItems = items.map(item => ({
                            [column.lookup.valueExpr]: item.key,
                            [column.lookup.displayExpr]: column.displayValueMap[item.key] ?? item.items[0].key
                        }));

                        newDataSource = new DataSource({
                            ...lookupDataSourceOptions,
                            ...loadOptions,
                            store: new ArrayStore({
                                data: lookupItems,
                                key: column.lookup.valueExpr,
                            })
                        });
                    } else {
                        const filter = this.combineFilters(
                            items.flatMap((data) => data.key).map((key => [
                                column.lookup.valueExpr, key,
                            ])),
                            'or'
                        );

                        newDataSource = new DataSource({
                            ...lookupDataSourceOptions,
                            ...loadOptions,
                            filter: this.combineFilters([filter, loadOptions.filter], 'and'),
                        });
                    }

                    if(!hasGroupPaging) {
                        newDataSource.on('customizeStoreLoadOptions', (e) => {
                            e.storeLoadOptions.take = loadOptions.take;
                            e.storeLoadOptions.skip = loadOptions.skip;
                        });
                    }

                    newDataSource
                        .load()
                        .done(d.resolve)
                        .fail(d.fail);
                }).fail(d.fail);
                return d;
            },
            key: column.lookup.valueExpr,
            byKey(key) {
                const d = Deferred();
                this.load({
                    filter: [column.lookup.valueExpr, '=', key],
                }).done(arr => {
                    d.resolve(arr[0]);
                });

                return d.promise();
            },
        };

        return lookupDataSource;
    },
};
