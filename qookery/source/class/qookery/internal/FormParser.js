/*
	Qookery - Declarative UI Building for Qooxdoo

	Copyright (c) Ergobyte Informatics S.A., www.ergobyte.gr

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

	$Id$
*/

/**
 * The FormParser will parse a form XML document to create
 * a fully populated IFormComponent into a container composite
 */
qx.Class.define("qookery.internal.FormParser", {

	extend: qx.core.Object,
	implement: [ qookery.IFormParser ],

	statics: {
		registry: qookery.internal.Registry.getInstance(),
		namedSizes: {
			"XXS":  28,
			"XS" :  46,
			"S"  :  74,
			"M"  : 120,
			"L"  : 194,
			"XL" : 314,
			"XXL": 508
		}
	},

	construct: function() {
		this.base(arguments);
		this.__namespaces = { };
		this.__formComponent = new qookery.internal.components.FormComponent();
	},

	members: {

		__formComponent: null,
		__namespaces: null,

		// IFormParser implementation

		create: function(xmlDocument, parentComposite, layoutData) {
			if(xmlDocument == null) throw new Error("An XML form must be supplied.");
			if(parentComposite == null) throw new Error("Parent composite must be supplied");
			var elements = qx.dom.Hierarchy.getChildElements(xmlDocument);
			var formElement = elements[0];

			// The form component, like all components, must go through all creation phases

			// Phase 1: New instance - already done in contructor

			// Phase 2: Creation

			var attributes = this.__parseAttributes(formElement);
			this.__formComponent.create(attributes);

			// Phase 3: Children

			this.__parseStatementBlock(formElement, this.__formComponent);

			// Phase 4: Setup

			this.__formComponent.setup(attributes);

			// Phase 5: Data binding - none for the form component

			// Phase 6: Going live

			var formWidget = this.__formComponent.getMainWidget();
			parentComposite.add(formWidget, layoutData);

			return this.__formComponent;
		},

		// Internal methods

		__parseStatementBlock: function(blockElement, parentComponent) {
			if(!qx.dom.Element.hasChildren(blockElement)) return;
			var children = qx.dom.Hierarchy.getChildElements(blockElement);
			for(var i = 0; i < children.length; i++) {
				var statementElement = children[i];
				var elementName = qx.dom.Node.getName(statementElement);
				if(this.constructor.registry.isComponentAvailable(elementName))
					this.__parseComponent(statementElement, parentComponent);
				else if(elementName == 'script')
					this.__parseScript(statementElement, parentComponent);
				else if(elementName == 'set')
					continue;
				else if(elementName == 'import')
					this.__parseImport(statementElement, parentComponent);
				else if(elementName == 'bind')
					this.__parseBind(statementElement, parentComponent);
				else if(elementName == 'translation')
					this.__parseTranslation(statementElement);
				else if(elementName == 'parsererror')
					throw new Error(qx.lang.String.format("Parser error in statement block: %1", [ qx.dom.Node.getText(statementElement) ]));
				else
					throw new Error(qx.lang.String.format("Unexpected XML element '%1' in statement block", [ elementName ]));
			}
		},

		__parseComponent: function(componentElement, parentComponent) {

			// Check conditionals

			var skipIfClientCode = this.__getAttribute(componentElement, "skip-if");
			if(skipIfClientCode) {
				var skip = parentComponent.executeClientCode(qx.lang.String.format("return (%1);", [ skipIfClientCode ]));
				if(skip) return;
			}

			// Phase 1: New Instance

			var componentType = qx.dom.Node.getName(componentElement);
			if(componentType == "component")
				componentType = this.__getAttribute(componentElement, "type");

			var component = this.constructor.registry.createComponent(parentComponent, componentType);
			var componentId = this.__getAttribute(componentElement, "id");
			if(componentId)
				this.__formComponent.registerComponent(component, componentId);

			// Phase 2: Creation

			var attributes = this.__parseAttributes(componentElement);
			this.__parseSetupBlock(componentElement, attributes);
			component.create(attributes);

			// Phase 3: Children

			this.__parseStatementBlock(componentElement, component);

			// Phase 4: Setup

			component.setup(attributes);

			// Phase 5: Data binding

			if(attributes['connect']) {
				var connection = this.__resolveQName(attributes['connect']);
				var modelProvider = qookery.Qookery.getInstance().getModelProvider();
				if(modelProvider == null)
					throw new Error("Install a model provider to handle connections in XML forms");
				modelProvider.handleConnection(component, connection[0], connection[1]);
			}

			// Phase 6: Going live

			parentComponent.addChild(component);
		},

		__parseAttributes: function(componentElement) {
			var attributes = { };
			var xmlAttributes = componentElement.attributes;
			for(var i = 0; i < xmlAttributes.length; i++) {
				var xmlAttribute = xmlAttributes.item(i);
				var attributeName = xmlAttribute.nodeName;
				var text = xmlAttribute.nodeValue;
				if(text == null || text.length == 0) continue;
				text = text.trim();
				if(text.length == 0) continue;
				var value = this.__convertAttributeValue(attributeName, text);
				attributes[attributeName] = value;
			}
			return attributes;
		},

		__parseSetupBlock: function(blockElement, attributes) {
			if(!qx.dom.Element.hasChildren(blockElement)) return;
			var children = qx.dom.Hierarchy.getChildElements(blockElement);
			for(var i = 0; i < children.length; i++) {
				var statementElement = children[i];
				var elementName = qx.dom.Node.getName(statementElement);
				if(elementName == 'set')
					this.__parseSet(statementElement, attributes);
			}
		},

		__parseScript: function(scriptElement, component) {
			var clientCode = this.__getNodeText(scriptElement);
			if(clientCode == null)
				throw new Error("Empty <script> element");
			var eventName = this.__getAttribute(scriptElement, "event");
			var actionName = this.__getAttribute(scriptElement, "action");
			if(eventName)
				component.addEventHandler(eventName, clientCode);
			else if(actionName)
				component.setAction(actionName, clientCode);
			else
				component.executeClientCode(clientCode);
		},

		__parseSet: function(setElement, attributes) {
			var text = this.__getNodeText(setElement);
			if(text == null)
				throw new Error("Empty <set> element");
			text = text.trim();
			if(text.length == 0)
				throw new Error("Empty <set> element");
			var attributeName = this.__getAttribute(setElement, "attribute");
			if(attributeName == null)
				throw new Error("<set> element is not specifying an attribute name");
			var value = this.__convertAttributeValue(attributeName, text);
			attributes[attributeName] = value;
		},

		__parseImport: function(importElement) {
			var className = this.__getAttribute(importElement, "class");
			var clazz = qx.Class.getByName(className);
			if(!clazz) throw new Error(qx.lang.String.format("Imported class '%1' not found", [ className ]));
			var key = this.__getAttribute(importElement, "key");
			if(!key) key = className.substring(className.lastIndexOf(".") + 1);
			this.__formComponent.registerUserContext(key, clazz);
		},

		__parseBind: function(bindElement) {
			var prefix = this.__getAttribute(bindElement, "prefix");
			var uri = this.__getAttribute(bindElement, "uri");
			this.__namespaces[prefix] = uri;
		},

		__parseTranslation: function(translationElement) {
			if(!qx.dom.Element.hasChildren(translationElement)) return;
			var languageCode = qx.xml.Element.getAttributeNS(translationElement, 'http://www.w3.org/XML/1998/namespace', 'lang');
			if(!languageCode) throw new Error("Language code missing");
			var messages = { };
			var prefix = this.__formComponent.getTranslationPrefix();
			var children = qx.dom.Hierarchy.getChildElements(translationElement);
			for(var i = 0; i < children.length; i++) {
				var messageElement = children[i];
				var elementName = qx.dom.Node.getName(messageElement);
				if(elementName != 'message')
					throw new Error(qx.lang.String.format("Unexpected XML element '%1' in statement block", [ elementName ]));
				var messageId = this.__getAttribute(messageElement, "id");
				if(!messageId) throw new Error("Message identifier missing");
				if(prefix) messageId = prefix + '.' + messageId;
				messages[messageId] = this.__getNodeText(messageElement);
			}
			qx.locale.Manager.getInstance().addTranslation(languageCode, messages);
		},

		__getAttribute: function(element, attributeName) {
			var text = qx.xml.Element.getAttributeNS(element, null, attributeName);
			if(text == null || text.length == 0) return null;
			text = text.trim();
			if(text.length == 0) return null;
			return text;
		},

		__getNodeText: function(node) {
			var text = qx.dom.Node.getText(node);
			if(text == null || text.length == 0) return null;
			text = text.trim();
			if(text.length == 0) return null;
			return text;
		},

		__resolveQName: function(qname) {
			var parts = qname.split(":");
			if(parts.length == 1) return [ "", qname ];
			var prefix = parts[0];
			var localPart = parts[1];
			var namespaceUri = this.__namespaces[prefix];
			if(!namespaceUri) throw new Error(qx.lang.String.format("Unable to resolve unknown namespace prefix '%1'", [ prefix ]));
			return [ namespaceUri, localPart ];
		},

		__convertAttributeValue: function(key, text) {
			switch(key) {

			// Integer attributes
			case "column-span":
			case "margin-bottom":
			case "margin-left":
			case "margin-right":
			case "margin-top":
			case "max-length":
			case "padding-bottom":
			case "padding-left":
			case "padding-right":
			case "padding-top":
			case "row-height":
			case "row-span":
			case "spacing":
			case "spacing-x":
			case "spacing-y":
				return parseInt(text);

			// Boolean attributes
			case "center":
			case "column-visibility-button-visible":
			case "enabled":
			case "read-only":
			case "required":
			case "rich":
			case "status-bar-visible":
			case "stretch":
			case "stretch-x":
			case "stretch-y":
			case "visible":
			case "wrap":
				return text == "true";

			// Size attributes
			case "width":
			case "height":
			case "min-width":
			case "min-height":
			case "max-width":
			case "max-height":
				return this.constructor.namedSizes[text] || parseInt(text);

			// Resource URI attributes
			case "icon":
			case "source":
				return qx.util.ResourceManager.getInstance().toUri(text);

			// Shorthand properties
			case "margin":
			case "padding":
				var value = text.split(/\W+/);
				value.forEach(function(element, index) { value[index] = parseInt(element); });
				return value;

			// Regular expressions
			case "filter":
				return new RegExp(text);
				
			default:
				// Fallback for unknown attributes
				return text;
			}
		}
	},

	destruct: function() {
		this.__formComponent = null;
		this.__namespaces = null;
	}
});
