package org.openremote.model.dashboard;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;

public class DashboardGridItem {

    // Fields
    protected String id;
    protected int x;
    protected int y;

    @Min(value = 1, message = "{Dashboard.gridItem.w.Min}")
    protected int w;

    @Min(value = 1, message = "{Dashboard.gridItem.h.Min}")
    protected int h;
    protected int minH;
    protected int minW;
    protected boolean noResize;
    protected boolean noMove;
    protected boolean locked;

    @NotBlank(message = "{Dashboard.gridItem.content.NotBlank}")
    protected String content;
}
