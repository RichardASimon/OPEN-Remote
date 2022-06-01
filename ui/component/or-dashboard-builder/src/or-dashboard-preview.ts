import manager, {DefaultColor4} from "@openremote/core";
import {css, html, LitElement, TemplateResult, unsafeCSS} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {style} from "./style";
import {
    Asset,
    Attribute,
    AttributeRef,
    DashboardGridItem,
    DashboardTemplate,
    DashboardWidget,
    DashboardWidgetType
} from "@openremote/model";
import {
    DashboardSizeOption,
    getHeightByPreviewSize,
    getPreviewSizeByPx,
    getWidthByPreviewSize,
    sizeOptionToString,
    stringToSizeOption
} from "./index";
import {InputType, OrInputChangedEvent} from "@openremote/or-mwc-components/or-mwc-input";
import {until} from "lit/directives/until.js";
import {GridItemHTMLElement, GridStack, GridStackElement, GridStackNode} from "gridstack";

// TODO: Add webpack/rollup to build so consumers aren't forced to use the same tooling
const gridcss = require('gridstack/dist/gridstack.min.css');
const extracss = require('gridstack/dist/gridstack-extra.css');

//language=css
const editorStyling = css`
    
    #view-options {
        padding: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    /* Margins on view options */
    #view-preset-select { margin-left: 20px; }
    #width-input { margin-left: 20px; }
    #height-input { margin-left: 10px; }
    #rotate-btn { margin-left: 10px; }
    
    .maingrid {
        border: 3px solid #909090;
        background: #FFFFFF;
        border-radius: 8px;
        overflow-x: hidden;
        overflow-y: scroll;
        height: 540px; /* TODO: Should be set according to input */
        width: 960px; /* TODO: Should be set according to input */
        padding: 4px;
        position: absolute;
        z-index: 0;
    }
    .maingrid__fullscreen {
        border: none;
        background: transparent;
        border-radius: 0;
        overflow-x: hidden;
        overflow-y: auto;
        height: auto;
        width: 100%;
        padding: 4px;
        /*pointer-events: none;*/
        position: relative;
        z-index: 0;
    }
    .maingrid__disabled {
        pointer-events: none;
        opacity: 40%;
    }
    .grid-stack-item-content {
        background: white;
        box-sizing: border-box;
        border: 2px solid #E0E0E0;
        border-radius: 4px;
        overflow: hidden !important;
    }
    .grid-stack-item-content__active {
        border: 2px solid ${unsafeCSS(DefaultColor4)};    
    }
    .gridItem {
        height: 100%;
        overflow: hidden;
    }
    
    /* Grid lines on the background of the grid */
    .grid-element {
        background-image:
                linear-gradient(90deg, #E0E0E0, transparent 1px),
                linear-gradient(90deg, transparent calc(100% - 1px), #E0E0E0),
                linear-gradient(#E0E0E0, transparent 1px),
                linear-gradient(transparent calc(100% - 1px), #E0E0E0 100%);
    }
`

/* -------------------------------------------------- */

export interface ORGridStackNode extends GridStackNode {
    widgetType: DashboardWidgetType;
}

@customElement("or-dashboard-preview")
export class OrDashboardPreview extends LitElement {

    static get styles() {
        return [unsafeCSS(gridcss), unsafeCSS(extracss), editorStyling, style];
    }

    @property()
    protected template?: DashboardTemplate

    @property() // Optional alternative for template
    protected readonly dashboardId?: string;

    @property({type: Object})
    protected selectedWidget: DashboardWidget | undefined;

    @property()
    protected editMode: boolean = false;

/*    @property() // Makes it fullscreen or shows controls for editing the size
    protected fullscreen: boolean = true;*/

    @property()
    protected previewWidth?: string;

    @property()
    protected previewHeight?: string;

    @property() // Optional alternative for previewWidth/previewHeight
    protected previewSize?: DashboardSizeOption;

    @property()
    protected rerenderPending: boolean = true;

    /* -------------- */

    @state()
    protected grid?: GridStack;

    @state()
    protected resizeObserver?: ResizeObserver;


    /* ------------------------------------------- */

    updated(changedProperties: Map<string, any>) {
        console.log(changedProperties);

        // Setup template (list of widgets and properties)
        if(this.template && this.dashboardId) {
            manager.rest.api.DashboardResource.get(this.dashboardId).then((response) => { this.template = response.data.template; });
        } else if(this.template == null && this.dashboardId == null) {
            console.error("Neither the template nor dashboardId attributes have been specified!");
        }

        // When switching from fullscreen and back the width/height needs to be set correctly
        /*if(changedProperties.has("fullscreen")) {
            if(this.fullscreen) {
                this.previewSize = DashboardSizeOption.FULLSCREEN;
            } else {
                this.previewSize = DashboardSizeOption.MEDIUM;
            }

            const mainGridContainer = this.shadowRoot?.querySelector(".maingrid") as HTMLElement;
            if(mainGridContainer != null) {
                if(this.previewSize == DashboardSizeOption.FULLSCREEN) {
                    mainGridContainer.classList.add("maingrid__fullscreen");
                } else if(mainGridContainer.classList.contains("maingrid__fullscreen")) {
                    mainGridContainer.classList.remove("maingrid__fullscreen");
                }
            }
        }*/

        if(changedProperties.has("template")) {
            console.log("Setting up a new Grid..");
            this.setupGrid(true, false)
        }

        if(changedProperties.has("selectedWidget")) {
            if(this.selectedWidget) {
                if(changedProperties.get("selectedWidget") != undefined) { // if previous selected state was a different widget
                    this.dispatchEvent(new CustomEvent("deselected", { detail: changedProperties.get("selectedWidget") as DashboardWidget }));
                }
                const foundItem = this.grid?.getGridItems().find((item) => {
                    return item.gridstackNode?.id == this.selectedWidget?.gridItem?.id;
                });
                if(foundItem != null) { this.selectGridItem(foundItem); }
                this.dispatchEvent(new CustomEvent("selected", { detail: this.selectedWidget }));

            } else {
                // Checking whether the mainGrid is not destroyed and there are Items to deselect...
                if(this.grid?.el != undefined && this.grid?.getGridItems() != null) {
                    this.deselectGridItems(this.grid.getGridItems());
                }
                this.dispatchEvent(new CustomEvent("deselected", { detail: changedProperties.get("selectedWidget") as DashboardWidget }));
            }
        }


        if(changedProperties.has("editMode") && changedProperties.has("fullscreen")) {
            console.log("Completely deleting and creating a new grid..");
            this.setupGrid(true, true);
        }


        if(changedProperties.has("editMode")) {
            const gridHTML = this.shadowRoot?.querySelector(".maingrid");
            if(gridHTML) {
                this.setupResizeObserver(gridHTML);
            }
        }

        if(changedProperties.has("previewWidth") || changedProperties.has("previewHeight")) {
            const gridHTML = this.shadowRoot?.querySelector(".maingrid") as HTMLElement;
            gridHTML.style.width = this.previewWidth!;
            gridHTML.style.height = this.previewHeight!;
            console.log("[" + this.previewWidth + " " + this.previewHeight + "]");
            console.log("[" + gridHTML.style.width + " " + gridHTML.style.height + "]");
            this.previewSize = getPreviewSizeByPx(this.previewWidth, this.previewHeight);
            console.log(this.previewSize);
        }

        if(changedProperties.has("previewSize") && this.previewSize != DashboardSizeOption.CUSTOM) {
            const mainGridContainer = this.shadowRoot?.querySelector(".maingrid") as HTMLElement;
            if(mainGridContainer != null) {
                if(this.previewSize == DashboardSizeOption.FULLSCREEN) {
                    mainGridContainer.classList.add("maingrid__fullscreen");
                } else if(mainGridContainer.classList.contains("maingrid__fullscreen")) {
                    mainGridContainer.classList.remove("maingrid__fullscreen");
                }
            }
            console.log("Preview Size has been changed!");
            this.previewWidth = getWidthByPreviewSize(this.previewSize);
            this.previewHeight = getHeightByPreviewSize(this.previewSize);
        }
    }


    /* ---------------------------------------- */

    setupGrid(recreate: boolean, force: boolean) {
        const gridElement = this.shadowRoot?.getElementById("gridElement");
        if(gridElement != null) {
            if(recreate && this.grid != null) {
                this.grid.destroy(false);
            }
            this.grid = GridStack.init({
                acceptWidgets: (this.editMode),
                animate: true,
                cellHeight: 'auto',
                cellHeightThrottle: 100,
                column: this.template?.columns,
                disableOneColumnMode: true,
                draggable: {
                    appendTo: 'parent', // Required to work, seems to be Shadow DOM related.
                    scroll: true
                },
                float: true,
                margin: 4,
                resizable: {
                    handles: 'all'
                },
                staticGrid: (!this.editMode),
                styleInHead: false
            }, gridElement);

            gridElement.style.backgroundSize = "" + this.grid.cellWidth() + "px " + this.grid.getCellHeight() + "px";
            gridElement.style.height = "100%";
            gridElement.style.minHeight = "100%";

            this.grid.on('dropped', (event: Event, previousWidget: any, newWidget: GridStackNode | undefined) => {
                if(this.grid != null && newWidget != null) {
                    this.grid.removeWidget((newWidget.el) as GridStackElement, true, false); // Removes dragged widget first
                    this.createWidget(newWidget as ORGridStackNode);
                    this.dispatchEvent(new CustomEvent("dropped", { detail: newWidget }));
                }
            });
            this.grid.on('change', (event: Event, items: any) => {
                if(this.template != null && this.template.widgets != null) {
                    console.log("Noticed a change in movement/sizing!");
                    (items as GridStackNode[]).forEach(node => {
                        const widget: DashboardWidget | undefined = this.template?.widgets?.find(widget => { return widget.gridItem?.id == node.id; });
                        if(widget != null && widget.gridItem != null) {
                            // console.log("Updating properties of " + widget.displayName);
                            widget.gridItem.x = node.x;
                            widget.gridItem.y = node.y;
                            widget.gridItem.w = node.w;
                            widget.gridItem.h = node.h;
                            // widget.gridItem.content = node.content;
                        }
                    });
                    // this.requestUpdate(); was required for or-chart since it does not show chart after moving it on the grid.
                    this.dispatchEvent(new CustomEvent("changed", {detail: { template: this.template }}));
                }
            });
        }
    }

    // Method for creating Widgets (reused at many places)
    createWidget(gridStackNode: ORGridStackNode): DashboardWidget {
        const randomId = (Math.random() + 1).toString(36).substring(2);
        let displayName = this.generateWidgetDisplayName(gridStackNode.widgetType);
        if(displayName == undefined) { displayName = "Widget #" + randomId; } // If no displayName, set random ID as name.
        const gridItem: DashboardGridItem = this.generateGridItem(gridStackNode, displayName);

        const widget = {
            id: randomId,
            displayName: displayName,
            gridItem: gridItem,
            widgetType: gridStackNode.widgetType
        } as DashboardWidget;

        const tempTemplate = this.template;
        tempTemplate?.widgets?.push(widget);
        this.template = Object.assign({}, tempTemplate); // Force property update
        return widget;
    }


    /* ------------------------------- */

    selectGridItem(gridItem: GridItemHTMLElement) {
        if(this.grid != null) {
            this.deselectGridItems(this.grid.getGridItems()); // deselecting all other items
            console.log(gridItem);
            gridItem.querySelectorAll<HTMLElement>(".grid-stack-item-content").forEach((item: HTMLElement) => {
                console.log(item);
                item.classList.add('grid-stack-item-content__active'); // Apply active CSS class
            });
        }
    }
    deselectGridItem(gridItem: GridItemHTMLElement) {
        gridItem.querySelectorAll<HTMLElement>(".grid-stack-item-content").forEach((item: HTMLElement) => {
            item.classList.remove('grid-stack-item-content__active'); // Remove active CSS class
        });
    }

    deselectGridItems(gridItems: GridItemHTMLElement[]) {
        gridItems.forEach(item => {
            this.deselectGridItem(item);
        })
    }

    onGridItemClick(gridItem: DashboardGridItem) {
        if(this.editMode) {
            if(this.selectedWidget?.gridItem?.id == gridItem.id) {
                this.selectedWidget = undefined;
            } else {
                this.selectedWidget = this.template?.widgets?.find(widget => { return widget.gridItem?.id == gridItem.id; });
            }
            console.log(this.selectedWidget);
            this.requestUpdate();
        }
    }

    // Render
    protected render() {
        console.log("Rendering the following template:");
        console.log(this.template);
        return html`
                <div id="buildingArea" style="display: flex; flex-direction: column; height: 100%;">
                    ${this.editMode ? html`
                        <div id="view-options">
                            <or-mwc-input id="zoom-btn" type="${InputType.BUTTON}" disabled outlined label="50%"></or-mwc-input>
                            <or-mwc-input id="view-preset-select" type="${InputType.SELECT}" outlined label="Preset size" .value="${sizeOptionToString(this.previewSize!)}" .options="${[sizeOptionToString(DashboardSizeOption.LARGE), sizeOptionToString(DashboardSizeOption.MEDIUM), sizeOptionToString(DashboardSizeOption.SMALL), sizeOptionToString(DashboardSizeOption.CUSTOM)]}" style="min-width: 220px;"
                                          @or-mwc-input-changed="${(event: OrInputChangedEvent) => { this.previewSize = stringToSizeOption(event.detail.value); }}"
                            ></or-mwc-input>
                            <or-mwc-input id="width-input" type="${InputType.NUMBER}" outlined label="Width" min="100" .value="${this.previewWidth?.replace('px', '')}" style="width: 90px"
                                          @or-mwc-input-changed="${(event: OrInputChangedEvent) => { this.previewWidth = event.detail.value + 'px'; }}"
                            ></or-mwc-input>
                            <or-mwc-input id="height-input" type="${InputType.NUMBER}" outlined label="Height" min="100" .value="${this.previewHeight?.replace('px', '')}" style="width: 90px;"
                                          @or-mwc-input-changed="${(event: OrInputChangedEvent) => { this.previewHeight = event.detail.value + 'px'; }}"
                            ></or-mwc-input>
                            <or-mwc-input id="rotate-btn" type="${InputType.BUTTON}" icon="screen-rotation"
                                          @or-mwc-input-changed="${() => { const newWidth = this.previewHeight; const newHeight = this.previewWidth; this.previewWidth = newWidth; this.previewHeight = newHeight; }}">
                            </or-mwc-input>
                            <or-mwc-input id="test-btn" type="${InputType.BUTTON}" icon="home"
                                          @or-mwc-input-changed="${() => { console.log(this.grid?.getGridItems())}}"
                            ></or-mwc-input>
                            <or-mwc-input id="test2-btn" type="${InputType.BUTTON}" icon="reload"
                                          @or-mwc-input-changed="${() => { this.requestUpdate(); }}"
                            ></or-mwc-input>
                        </div>
                    ` : undefined}
                    <div id="container" style="display: flex; justify-content: center; height: 100%;">
                        <div class="maingrid">
                            <!-- Gridstack element on which the Grid will be rendered -->
                            <div id="gridElement" class="grid-stack ${this.previewSize == DashboardSizeOption.FULLSCREEN ? undefined : 'grid-element'}">
                                <!--<div class="grid-stack-item">
                                    <div class="grid-stack-item-content">
                                        <span>Temporary content</span>
                                    </div>
                                </div>-->
                                ${this.template?.widgets?.map((widget) => {
                                    return html`
                                        <div class="grid-stack-item" gs-id="${widget.gridItem?.id}" gs-x="${widget.gridItem?.x}" gs-y="${widget.gridItem?.y}" gs-w="${widget.gridItem?.w}" gs-h="${widget.gridItem?.h}" @click="${(event: MouseEvent) => { this.onGridItemClick(widget.gridItem!); }}">
                                            <div class="grid-stack-item-content">
                                                ${until(this.getWidgetContent(widget).then((content) => {
                                                    return content;
                                                }))}
                                            </div>
                                        </div>
                                    `
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `
    }

    setupResizeObserver(element: Element): ResizeObserver {
        console.log("Setting up ResizeObserver..");
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver((entries) => {

            console.log("Noticed a Dashboard resize! Updating the grid..");
            this.setupGrid(true, true);

        });
        this.resizeObserver.observe(element);
        return this.resizeObserver;
    }


    /* ------------------------------ */

    generateWidgetDisplayName(widgetType: DashboardWidgetType): string | undefined {
        if(this.template?.widgets != null) {
            const filteredWidgets: DashboardWidget[] = this.template.widgets.filter((x) => { return x.widgetType == widgetType; });
            switch (widgetType) {
                case DashboardWidgetType.MAP: return "Map #" + (filteredWidgets.length + 1);
                case DashboardWidgetType.CHART: return "Chart #" + (filteredWidgets.length + 1);
            }
        }
        return undefined;
    }

    // Generating the Grid Item details like X and Y coordinates for GridStack to work.
    generateGridItem(gridstackNode: ORGridStackNode, displayName: string): DashboardGridItem {
        const randomId = (Math.random() + 1).toString(36).substring(2);
        return {
            id: randomId,
            x: gridstackNode.x,
            y: gridstackNode.y,
            w: 2,
            h: 2,
            minW: this.getWidgetMinWidth(gridstackNode.widgetType),
            minH: this.getWidgetMinWidth(gridstackNode.widgetType),
            noResize: false,
            noMove: false,
            locked: false,
            // content: this.getWidgetContent(gridstackNode.widgetType, displayName)
        }
    }
    getWidgetMinWidth(widgetType: DashboardWidgetType): number {
        switch (widgetType) {
            case DashboardWidgetType.CHART: return 2;
            case DashboardWidgetType.MAP: return 4;
        }
    }




    /* --------------------------------------- */

    // Widget related methods such as getting Widget HTML,
    // or generating fake data for the widgets.


    async getWidgetContent(widget: DashboardWidget): Promise<TemplateResult> {
        /*console.log("Getting widget content for widget " + widget.id);
        console.log(widget);*/
        const _widget = Object.assign({}, widget);
        if(_widget.gridItem) {
            switch (_widget.widgetType) {

                case DashboardWidgetType.CHART: {
                    let assets: Asset[] = [];
                    let attributes: [number, Attribute<any>][] = [];
                    if(!this.editMode) {
                        const response = await manager.rest.api.AssetResource.queryAssets({
                            ids: widget.widgetConfig?.attributeRefs?.map((x: AttributeRef) => { return x.id; }) as string[]
                        });
                        console.error("Getting attribute data from database!");
                        assets = response.data;
                        attributes = widget.widgetConfig?.attributeRefs?.map((attrRef: AttributeRef) => {
                            const assetIndex = assets.findIndex((asset) => asset.id === attrRef.id);
                            const asset = assetIndex >= 0 ? assets[assetIndex] : undefined;
                            return asset && asset.attributes ? [assetIndex!, asset.attributes[attrRef.name!]] : undefined;
                        }).filter((indexAndAttr: any) => !!indexAndAttr) as [number, Attribute<any>][];
                    } else {
                        _widget.widgetConfig?.attributeRefs?.forEach((attrRef: AttributeRef) => {
                            if(!assets.find((asset: Asset) => { return asset.id == attrRef.id; })) {
                                assets.push({ id: attrRef.id, name: "Asset X", type: "ThingAsset" });
                            }
                        });
                        attributes = [];
                        _widget.widgetConfig?.attributeRefs?.forEach((attrRef: AttributeRef) => {
                            attributes.push([0, { name: attrRef.name }]);
                        });
                    }
                    /*console.log(assets);
                    console.log(attributes);*/
                    return html`
                        <div class="gridItem">
                            <or-chart .assets="${assets}" .assetAttributes="${attributes}" .period="${widget.widgetConfig?.period}" 
                                      .dataProvider="${this.editMode ? (async (startOfPeriod: number, endOfPeriod: number, timeUnits: any, stepSize: number) => { return this.generateMockData(_widget, startOfPeriod, endOfPeriod, 20); }) : undefined}"
                                      showLegend="${_widget.widgetConfig?.showLegend}" .realm="${manager.displayRealm}" .showControls="${_widget.widgetConfig?.showTimestampControls}" style="position: absolute; height: 100%"
                            ></or-chart>
                            ${/*this.editMode*/ false ? html`
                                <div style="position: absolute; right: 0; bottom: 0; padding: 4px;">
                                    <span style="font-style: italic;">Uses fake data</span>
                                </div>
                            ` : undefined}
                        </div>
                    `;
                }

                // TODO: Should depend on custom properties set in widgetsettings.
                case DashboardWidgetType.MAP: {
                    return html`
                        <div class='gridItem'>
                            <or-map center='5.454250, 51.445990' zoom='5' style='height: 100%; width: 100%;'></or-map>
                        </div>
                    `;
                }
            }
        }
        return html`<span>Error!</span>`;
    }

    protected generateMockData(widget: DashboardWidget, startOfPeriod: number, endOfPeriod: number, amount: number = 10): any {
        /*console.log("Generating mock data..");*/
        switch (widget.widgetType) {
            case DashboardWidgetType.CHART: {
                const mockTime: number = startOfPeriod;
                const chartData: any[] = [];
                const interval = (Date.now() - startOfPeriod) / amount;

                // Generating random coordinates on the chart
                let data: any[] = [];
                widget.widgetConfig?.attributeRefs?.forEach((attrRef: AttributeRef) => {
                    let valueEntries: any[] = [];
                    let prevValue: number = 100;
                    for(let i = 0; i < amount; i++) {
                        const value = Math.floor(Math.random() * ((prevValue + 2) - (prevValue - 2)) + (prevValue - 2))
                        valueEntries.push({
                            x: (mockTime + (i * interval)),
                            y: value
                        });
                        prevValue = value;
                    }
                    data.push(valueEntries);
                })

                // Making a line for each attribute
                widget.widgetConfig?.attributeRefs?.forEach((attrRef: AttributeRef) => {
                    chartData.push({
                        backgroundColor: ["#3869B1", "#DA7E30", "#3F9852", "#CC2428", "#6B4C9A", "#922427", "#958C3D", "#535055"][chartData.length],
                        borderColor: ["#3869B1", "#DA7E30", "#3F9852", "#CC2428", "#6B4C9A", "#922427", "#958C3D", "#535055"][chartData.length],
                        data: data[chartData.length],
                        fill: false,
                        label: attrRef.name,
                        pointRadius: 2
                    });
                });
                /*console.log(chartData);*/
                return chartData;
            }
        }
        return [];
    }
}