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
*/

qx.Class.define("qookerydemo.ResultArea",
{
	extend: qx.ui.container.Scroll,

	construct: function(component) {
		this.base(arguments);
	},

	members: {

		__formComponent: null,

		loadForm: function(formXml) {
			this._disposeObjects("__formComponent");
			var xmlDocument = qx.xml.Document.fromString(formXml);
			var parser = qookery.Qookery.createFormParser();
			try {
				this.__formComponent = parser.parseXmlDocument(xmlDocument);
				this.__formComponent.addListenerOnce("close", function() {
					this._disposeObjects("__formComponent");
				}, this);
				this.add(this.__formComponent.getMainWidget());
			}
			catch(e) {
				this.error("Error creating form window", e);
			}
			finally {
				parser.dispose();
			}
		},

		getFormComponent: function() {
			return this.__formComponent;
		},

		getModel: function() {
			return this.__formComponent.getModel();
		},

		setModel: function(model) {
			this.__formComponent.setModel(model);
		}
	},

	destruct: function() {
		this._disposeObjects("__formComponent");
	}
});
