/*
 * Copyright 2017, OpenRemote Inc.
 *
 * See the CONTRIBUTORS.txt file in the distribution for a
 * full listing of individual contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
package org.openremote.manager.server.asset;

import elemental.json.JsonValue;
import org.openremote.model.Attribute;
import org.openremote.model.AttributeType;
import org.openremote.model.asset.Asset;

import java.util.Date;

/**
 * An asset attribute value change that can be handled by a sequence of processors.
 */
public class AssetUpdate {

    /**
     * Processors of updates can change the status to direct further processing.
     */
    public enum Status {
        /**
         * Processor is happy for update to continue through the system.
         */
        CONTINUE,

        /**
         * Processor has finally handled the update, cancel further processing.
         */
        HANDLED,

        /**
         * Don't process event in any more rule engines but continue through rest of processing chain.
         */
        RULES_HANDLED,

        /**
         * Processor encountered an error trying to process the update, cancel further processing and escalate.
         */
        ERROR,

        /**
         * Indicates that this update has been through the entire processing chain; the object can no longer be
         * mutated at this stage.
         */
        COMPLETED
    }

    final protected Attribute attribute;

    final protected Date assetCreatedOn;

    final protected String assetId;

    final protected String assetName;

    final protected String assetType;

    final protected String[] assetPath;

    final protected String assetParentId;

    final protected String assetParentName;

    final protected String assetParentType;

    final protected String assetRealmId;

    final protected String assetRealmName;

    final protected double[] coordinates;

    final protected JsonValue oldValue;

    final protected long oldValueTimestamp;

    protected Status status = Status.CONTINUE;

    protected Throwable error;

    final protected Class<?> sender;

    public AssetUpdate(Asset asset, Attribute attribute) {
        this(asset, attribute, null, 0, null);
    }

    public AssetUpdate(Asset asset, Attribute attribute, JsonValue oldValue, long oldValueTimestamp, Class<?> sender) {
        this.attribute = attribute;
        this.assetId = asset.getId();
        this.assetName = asset.getName();
        this.assetPath = asset.getPath();
        this.assetType = asset.getType();
        this.assetCreatedOn = asset.getCreatedOn();
        this.assetParentId = asset.getParentId();
        this.assetParentName = asset.getParentName();
        this.assetParentType = asset.getParentType();
        this.assetRealmId = asset.getRealmId();
        this.assetRealmName = asset.getTenantRealm();
        this.coordinates = asset.getCoordinates();
        this.oldValue = oldValue;
        this.oldValueTimestamp = oldValueTimestamp;
        this.sender = sender;
    }

    public Date getAssetCreatedOn() {
        return assetCreatedOn;
    }

    public String getAssetId() {
        return assetId;
    }

    public String getAssetName() {
        return assetName;
    }

    public String getAssetType() {
        return assetType;
    }

    public String[] getAssetPath() {
        return assetPath;
    }

    public String getAssetParentId() {
        return assetParentId;
    }

    public String getAssetParentName() {
        return assetParentName;
    }

    public String getAssetParentType() {
        return assetParentType;
    }

    public String getAssetRealmId() {
        return assetRealmId;
    }

    public String getAssetRealmName() {
        return assetRealmName;
    }

    public double[] getCoordinates() {
        return coordinates;
    }

    public JsonValue getOldValue() {
        return oldValue;
    }

    public long getOldValueTimestamp() {
        return oldValueTimestamp;
    }

    public Status getStatus() {
        return status;
    }

    public Throwable getError() {
        return error;
    }

    public Class<?> getSender() {
        return sender;
    }

    public JsonValue getValue() {
        return attribute.getValue();
    }

    public String getAttributeName() {
        return attribute.getName();
    }

    public long getValueTimestamp() {
        return attribute.getValueTimestamp();
    }

    public AttributeType getAttributeType() {
        return attribute.getType();
    }

    public boolean isCompleted() {
        return getStatus() == Status.COMPLETED;
    }

    public boolean isValueChanged() {
        return !attribute.getValue().jsEquals(oldValue);
    }

    /////////////////////////////////////////////////////////////////
    // GETTERS AND SETTERS BELOW CAN ONLY BE USED WHEN STATUS IS NOT COMPLETED
    /////////////////////////////////////////////////////////////////

    public Attribute getAttribute() {
        if (!isCompleted()) {
            return attribute;
        }

        return null;
    }

    public void setValue(JsonValue value) {
        if (!isCompleted()) {
            attribute.setValue(value);
        }
    }

    public void setValueUnchecked(JsonValue value) {
        if (!isCompleted()) {
            attribute.setValueUnchecked(value);
        }
    }

    public void setStatus(Status status) {
        if (!isCompleted()) {
            this.status = status;
        }
    }

    public void setError(Throwable error) {
        if (!isCompleted()) {
            this.error = error;
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        AssetUpdate that = (AssetUpdate) o;

        return assetId.equals(that.assetId) &&
                getAttributeName().equalsIgnoreCase(that.getAttributeName()) &&
                getValue().jsEquals(that.getValue()) &&
                getValueTimestamp() == that.getValueTimestamp() &&
                ((oldValue == null && that.oldValue == null) || (oldValue != null && oldValue.jsEquals(that.oldValue))) &&
                oldValueTimestamp == that.oldValueTimestamp;
    }

    @Override
    public int hashCode() {
        return assetId.hashCode() + getAttributeName().hashCode() + getValue().hashCode() + Long.hashCode(getValueTimestamp()) + (oldValue != null ? oldValue.hashCode() : 0) + Long.hashCode(oldValueTimestamp);
    }

    @Override
    public String toString() {
        return getClass().getSimpleName() + "{" +
            "assetId=" + getAssetName() +
            "attributeName=" + getAttributeName() +
            "value=" + getValue().toJson() +
            "valueTimestamp=" + getValueTimestamp() +
            "oldValue=" + getOldValue().toJson() +
            "oldValueTimestamp=" + getOldValueTimestamp() +
            '}';
    }
}
