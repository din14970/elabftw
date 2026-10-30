/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2023 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */
import { normalizeFieldName } from './misc';
import { autoResize, Metadata } from './Metadata.class';
import { ExtraFieldInputType } from './metadataInterfaces';
import type { ValidMetadata } from './metadataInterfaces';
import JsonEditorHelper from './JsonEditorHelper.class';
import { JsonEditorActions } from './JsonEditorActions.class';
import { ApiC } from './api';
import i18next from './i18n';
import { merge } from 'lodash-es';
import $ from 'jquery';
import { notify } from './notify';
import { entity } from './getEntity';

function createButton(action: string, btnType: string, content?: string): HTMLButtonElement {
  const btn: HTMLButtonElement = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.dataset.action = action;
  btn.classList.add('btn', btnType);
  btn.textContent = content ?? '';
  return btn;
}

function clearMultiFieldForm() {
  const multifieldContainer = document.getElementById('newMultifieldSubFieldsContainer');
  if (multifieldContainer) {
    multifieldContainer.innerHTML = '';
  }
}

function clearForm() {
  // remove all extra inputs (dropdown and radio)
  const form = (document.getElementById('newFieldForm') as HTMLFormElement);
  form.querySelectorAll('.is-extra-input').forEach(i => i.parentElement.remove());
  clearMultiFieldForm();
  form.reset();
}

function toggleContentDiv(key: string) {
  const keys = ['text', 'classic', 'selectradio', 'checkbox', 'number', 'multifield'];
  document.getElementById('newFieldContentDiv_' + key).toggleAttribute('hidden', false);
  // remove the shown one from the list and hide all others
  keys.filter(k => k !== key).forEach(k => {
    document.getElementById('newFieldContentDiv_' + k).toggleAttribute('hidden', true);
    // Clear multifield container when hiding it
    if (k === 'multifield') {
      clearMultiFieldForm()
    }
  });
}

function addMultifieldSubFieldRow(name = '', type = 'text', options?: string[], defaultValue = '', description = '', position = 0): void {
  const container = document.getElementById('newMultifieldSubFieldsContainer');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'multifield-subfield-row mb-2';
  row.dataset.subFieldName = name;

  const inputGroup = document.createElement('div');
  inputGroup.className = 'input-group';

  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'form-control multifield-subfield-name';
  nameInput.placeholder = i18next.t('Sub-field name');
  nameInput.value = name;
  inputGroup.appendChild(nameInput);

  // Position input (hidden, auto-assigned)
  const positionInput = document.createElement('input');
  positionInput.type = 'hidden';
  positionInput.className = 'multifield-subfield-position';
  positionInput.value = String(position);
  inputGroup.appendChild(positionInput);

  // Type select
  const typeSelect = document.createElement('select');
  typeSelect.className = 'form-control multifield-subfield-type';
  [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'items', label: 'Resource' },
    { value: 'experiments', label: 'Experiment' },
    { value: 'users', label: 'User' },
    { value: 'compounds', label: 'Compound' },
  ].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = i18next.t(opt.label);
    typeSelect.appendChild(option);
  });
  typeSelect.value = type;
  inputGroup.appendChild(typeSelect);

  // Default value input
  const defaultInput = document.createElement('input');
  defaultInput.type = 'text';
  defaultInput.className = 'form-control multifield-subfield-default';
  defaultInput.placeholder = i18next.t('Default value') + '...';
  defaultInput.value = defaultValue;
  inputGroup.appendChild(defaultInput);

  // Description input (for tooltip)
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'form-control multifield-subfield-description';
  descInput.placeholder = i18next.t('Description') + '...';
  descInput.value = description;
  inputGroup.appendChild(descInput);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-secondary btn-sm multifield-remove-subfield';
  removeBtn.innerHTML = '<i class="fas fa-minus"></i>';
  const removeBtnWrapper = document.createElement('div');
  removeBtnWrapper.className = 'input-group-append';
  removeBtnWrapper.appendChild(removeBtn);
  inputGroup.appendChild(removeBtnWrapper);

  row.appendChild(inputGroup);

  // Choices container (for select type) - reusing the existing pattern
  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'multifield-subfield-options mt-1';
  choicesDiv.hidden = type !== 'select';

  const choicesLabel = document.createElement('label');
  choicesLabel.className = 'smallgray';
  choicesLabel.textContent = i18next.t('Choices');
  choicesDiv.appendChild(choicesLabel);

  const choicesContainer = document.createElement('div');
  choicesContainer.className = 'multifield-subfield-choices-container';
  choicesDiv.appendChild(choicesContainer);

  // Add initial choice inputs
  const choiceInputs = [];
  if (options && options.length > 0) {
    options.forEach(opt => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control mb-1 multifield-subfield-choice-input';
      input.value = opt;
      input.dataset.purpose = 'choice';
      choicesContainer.appendChild(input);
      choiceInputs.push(input);
    });
  } else {
    // Add two default inputs
    for (let i = 0; i < 2; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control mb-1 multifield-subfield-choice-input';
      input.dataset.purpose = 'choice';
      choicesContainer.appendChild(input);
    }
  }

  // Add choice button
  const addChoiceBtn = document.createElement('button');
  addChoiceBtn.type = 'button';
  addChoiceBtn.className = 'btn btn-secondary btn-sm multifield-add-choice';
  addChoiceBtn.textContent = i18next.t('Add another choice');
  addChoiceBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control mb-1 multifield-subfield-choice-input';
    input.dataset.purpose = 'choice';
    choicesContainer.appendChild(input);
    input.focus();
  });
  choicesDiv.appendChild(addChoiceBtn);

  row.appendChild(choicesDiv);
  container.appendChild(row);

  // Toggle options visibility when type changes
  typeSelect.addEventListener('change', () => {
    choicesDiv.hidden = typeSelect.value !== 'select';
  });

  // Handle remove button
  removeBtn.addEventListener('click', () => {
    row.remove();
  });
}

if (document.getElementById('metadataDiv') && entity.id) {

  // add extra fields elements from metadata json
  const JsonEditorHelperC = new JsonEditorHelper(entity);
  // only run if there is the json-editor block
  if (document.getElementById('json-editor')) {
    const JsonEditorActionsC = new JsonEditorActions();
    JsonEditorActionsC.init(JsonEditorHelperC, true);
  }
  const MetadataC = new Metadata(entity, JsonEditorHelperC);
  MetadataC.display('edit');

  const saveButton = document.querySelector('[data-action="save-new-field"]') as HTMLButtonElement;
  const editButton = document.querySelector('[data-action="edit-extra-field"]') as HTMLButtonElement;

  // Add click listener and do action based on which element is clicked
  document.querySelector('.real-container').addEventListener('click', event => {
    const el = (event.target as HTMLElement);
    if (el.matches('[data-action="metadata-edit-field"]')) {
      $('#' + el.dataset.target).modal('toggle');
      // toggle buttons for edit modal
      saveButton.setAttribute('hidden', 'hidden');
      editButton.removeAttribute('hidden');

      // once modal is up, check fields to update
      const fieldGroupSelect = document.getElementById('newFieldGroupSelect') as HTMLSelectElement;
      const fieldDescriptionInput = document.getElementById('newFieldDescriptionInput') as HTMLInputElement;

      const extraField = el.parentElement.parentElement.closest('div');
      if (!extraField) {
        notify.error('not-found');
        return;
      }
      // store current name as attribute, to use as field's key and update
      const fieldNameInput = document.getElementById('newFieldKeyInput') as HTMLInputElement;
      const fieldName = extraField.querySelector('label').innerText.trim();
      fieldNameInput.dataset.name = fieldName;

      // populate modal with current extraField values
      MetadataC.read().then(metadata => {
        // handle keys with extra spaces (e.g. from manual json editor) by matching trimmed names
        const realKey = Object.keys(metadata.extra_fields).find(
          key => key.trim() === fieldName,
        );
        const fieldData = realKey ? metadata.extra_fields[realKey] : undefined;
        const fieldType = fieldData.type?.trim() || 'text';
        // set field type
        const fieldTypeSelect = document.getElementById('newFieldTypeSelect') as HTMLSelectElement;
        fieldTypeSelect.value = fieldType as string;
        // prefill switches
        (document.getElementById('blankValueOnDuplicateSwitch') as HTMLInputElement).checked = !!fieldData.blank_value_on_duplicate;
        (document.getElementById('requiredSwitch') as HTMLInputElement).checked = !!fieldData.required;
        (document.getElementById('newFieldAllowMultiSelect') as HTMLInputElement).checked = !!fieldData.allow_multi_values;

        let containerId, sourceArray, toggleDiv;
        // same behaviour is applied for select, radio and number. Only div name is different
        if (fieldType === ExtraFieldInputType.Select || fieldType === ExtraFieldInputType.Radio) {
          containerId = 'choicesInputDiv';
          sourceArray = fieldData.options;
          toggleDiv = 'selectradio';
        } else if (fieldType === ExtraFieldInputType.Number) {
          containerId = 'unitChoicesInputDiv';
          sourceArray = fieldData.units;
          toggleDiv = 'number';
        }

        if (toggleDiv) {
          toggleContentDiv(toggleDiv);
          const fieldValueInputDiv = document.getElementById(containerId);
          fieldValueInputDiv.innerHTML = '';

          // populate the corresponding container
          if (sourceArray) {
            sourceArray.forEach(item => {
              // Create group
              const newGroup = document.createElement('div');
              newGroup.classList.add('input-group', 'mb-1');
              // Create input
              const input = document.createElement('input');
              input.classList.add('form-control', 'is-extra-input');
              input.type = 'text';
              input.value = item;
              // Create button append div
              const appendDiv = document.createElement('div');
              appendDiv.classList.add('input-group-append');
              // Create self-remove button
              const btn = createButton('remove-self', 'btn-secondary', '-');
              appendDiv.appendChild(btn);
              // Assemble elements
              newGroup.append(input, appendDiv);
              fieldValueInputDiv.append(newGroup);
            });
          }
        } else if (fieldType === ExtraFieldInputType.Checkbox) {
          toggleContentDiv('checkbox');
          const checkboxSelect = document.getElementById('newFieldCheckboxDefaultSelect') as HTMLSelectElement;
          const fieldValue = Array.isArray(fieldData.value) ? fieldData.value[0] ?? '' : fieldData.value;
          checkboxSelect.value = fieldValue === 'on' ? 'checked' : 'unchecked';
        } else if (fieldType === ExtraFieldInputType.Multifield) {
          toggleContentDiv('multifield');
          // Populate sub-fields
          const subFieldsContainer = document.getElementById('newMultifieldSubFieldsContainer');
          subFieldsContainer.innerHTML = '';

          if (fieldData.sub_fields && typeof fieldData.sub_fields === 'object') {
            // sub_fields is now an object/map keyed by field name
            Object.entries(fieldData.sub_fields).forEach(([name, subField]) => {
              const sf = subField as {type?: string, options?: string[], default?: string|number, description?: string, position?: number};
              const defaultStr = sf.default !== undefined && sf.default !== null ? String(sf.default) : '';
              addMultifieldSubFieldRow(
                name,
                sf.type || 'text',
                sf.options,
                defaultStr,
                sf.description || '',
                sf.position ?? 0
              );
            });
          }
          // Add at least one empty row if no sub-fields
          if (!fieldData.sub_fields || Object.keys(fieldData.sub_fields || {}).length === 0) {
            addMultifieldSubFieldRow('', 'text', undefined, '', '', 0);
          }
        } else {
          // Default handling for simple text-based inputs
          const fieldValueTextArea = document.getElementById('newFieldValueTextArea') as HTMLTextAreaElement;
          const fieldValue = Array.isArray(fieldData.value) ? fieldData.value[0] ?? '' : fieldData.value;
          fieldValueTextArea.value = String(fieldValue ?? '');
        }

        fieldGroupSelect.value = fieldData.group_id ?? '-1';
        fieldTypeSelect.value = fieldType;
        fieldNameInput.value = fieldName;
        fieldDescriptionInput.value = fieldData.description ?? null;
      });
    }
    // DELETE EXTRA FIELD
    if (el.matches('[data-action="metadata-rm-field"]')) {
      if (confirm(i18next.t('generic-delete-warning'))) {
        MetadataC.read().then(metadata => {
          const name = el.parentElement.parentElement.closest('div').querySelector('label').innerText.trim();
          delete metadata.extra_fields[name];
          MetadataC.cleanupMetadata(metadata as ValidMetadata);
          MetadataC.update(metadata as ValidMetadata).then(() => document.getElementById('metadataDiv').scrollIntoView({behavior: 'smooth'}));
        });
      }
    }
  });

  // FIELD BUILDER CODE
  if (document.getElementById('fieldBuilderModal')) {

    $('#fieldBuilderModal').on('hidden.bs.modal', () => {
      // reset to default state on close
      if (!editButton.hasAttribute('hidden') && saveButton.hasAttribute('hidden')) {
        editButton.setAttribute('hidden', 'hidden');
        saveButton.removeAttribute('hidden');
      }
      // reset all input fields except default (text)
      document.querySelectorAll('[id^="newFieldContentDiv_"]:not([id="newFieldContentDiv_text"])')
        .forEach(div => {
          (div as HTMLDivElement).hidden = true;
        });
      document.getElementById('newFieldContentDiv_text').hidden = false;
      clearForm();
    });

    // When modal is shown, initialize the form based on current type
    $('#fieldBuilderModal').on('shown.bs.modal', () => {
      const fieldTypeSelect = document.getElementById('newFieldTypeSelect') as HTMLSelectElement;
      const fieldType = fieldTypeSelect.value as ExtraFieldInputType;

      // Clear any leftover state
      clearForm();

      // For multifield, default to allow multiple values
      if (fieldType === 'multifield') {
        (document.getElementById('newFieldAllowMultiSelect') as HTMLInputElement).checked = true;
      }

      // Trigger content div toggle based on current type
      if (fieldType === 'multifield') {
        toggleContentDiv('multifield');
        // Ensure there's at least one sub-field row
        const container = document.getElementById('newMultifieldSubFieldsContainer');
        if (container && container.children.length === 0) {
          addMultifieldSubFieldRow('', 'text', undefined, '', '', 0);
        }
      }
    });

    addAutocompleteToExtraFieldsKeyInputs();

    // when the type is selected, the default value input's type is changed to match
    document.getElementById('newFieldTypeSelect').addEventListener('change', event => {
      const fieldType = (event.target as HTMLSelectElement).value;
      const valueInput = document.getElementById('newFieldValueInput');

      switch (fieldType as ExtraFieldInputType) {
      case ExtraFieldInputType.Date:
      case ExtraFieldInputType.DateTime:
      case ExtraFieldInputType.Email:
      case ExtraFieldInputType.Url:
      case ExtraFieldInputType.Time:
      case ExtraFieldInputType.Experiments:
      case ExtraFieldInputType.Items:
      case ExtraFieldInputType.Users:
      case ExtraFieldInputType.Compounds:
        valueInput.setAttribute('type', fieldType);
        toggleContentDiv('classic');
        break;
      case ExtraFieldInputType.Select:
        toggleContentDiv('selectradio');
        break;
      case ExtraFieldInputType.Radio:
        toggleContentDiv('selectradio');
        break;
      case ExtraFieldInputType.Checkbox:
      case ExtraFieldInputType.Number:
      case ExtraFieldInputType.Text:
        toggleContentDiv(fieldType);
        break;
      case ExtraFieldInputType.Multifield:
        toggleContentDiv('multifield');
        // Initialize with one empty sub-field row
        const container = document.getElementById('newMultifieldSubFieldsContainer');
        if (container && container.children.length === 0) {
          addMultifieldSubFieldRow('', 'text', undefined, '', '', 0);
        }
        break;
      default:
        break;
      }
    });

    document.getElementById('fieldLoaderModal').addEventListener('click', async event => {
      const el = (event.target as HTMLElement);
      // LOAD METADATA FROM TEMPLATE/CATEGORY
      if (el.matches('[data-action="load-metadata-from"]')) {
        const select = (document.getElementById(`loadMetadataSelect_${el.dataset.target}`) as HTMLSelectElement);
        const selectedIndex = select.selectedIndex;
        const id = select.options[selectedIndex].value;
        const textarea = (document.getElementById('loadMetadataTextarea') as HTMLInputElement);
        ApiC.getJson(`${el.dataset.target}/${id}`).then(json => {
          const jsonObj = JSON.parse(json.metadata);
          textarea.value = JSON.stringify(jsonObj, null, 2);
          // prevent saving an empty value
          if (jsonObj === null) {
            return;
          }
          const applyBtn = (document.getElementById('applyMetadataLoadBtn') as HTMLButtonElement);
          applyBtn.removeAttribute('disabled');
        });
      } else if (el.matches('[data-action="load-metadata-from-textarea"]')) {
        const textarea = (document.getElementById('loadMetadataTextarea') as HTMLInputElement);
        const MetadataC = new Metadata(entity, new JsonEditorHelper(entity));
        const currentMetadata = await ApiC.getJson(`${entity.type}/${entity.id}`).then(json => JSON.parse(json.metadata));
        // we need to use lodash's merge because Object.assign() or spread operator will only do shallow merge
        const mergedMetadata = merge(JSON.parse(textarea.value), currentMetadata);
        ApiC.patch(`${entity.type}/${entity.id}`, {metadata: JSON.stringify(mergedMetadata)}).then(() => {
          MetadataC.display('edit');
          textarea.value = '';
        }).then(() => document.getElementById('metadataDiv').scrollIntoView({behavior: 'smooth'}));
      }
    });

    document.getElementById('fieldBuilderModal').addEventListener('click', event => {
      const el = (event.target as HTMLElement);
      const grpSel = (document.getElementById('newFieldGroupSelect') as HTMLSelectElement);
      // adapt textarea size to text to prevent missing existing content
      const textAreaField = (document.getElementById('newFieldValueTextArea') as HTMLTextAreaElement);
      if (textAreaField) {
        requestAnimationFrame(() => autoResize(textAreaField));
      }
      // SAVE NEW EXTRA FIELD
      if (el.matches('[data-action="save-new-field"]')) {
        if ((document.getElementById('newFieldForm') as HTMLFormElement).reportValidity() === false) {
          notify.error('form-validation-error');
          return;
        }

        const fieldKeyValue = (document.getElementById('newFieldKeyInput') as HTMLInputElement).value.trim();
        const fieldKey = normalizeFieldName(fieldKeyValue);

        let json = {};
        // get the current metadata
        MetadataC.read().then(metadata => {
          if (metadata) {
            json = metadata;
          }
          if (!Object.prototype.hasOwnProperty.call(json, 'extra_fields')) {
            json['extra_fields'] = {};
          }
          // build the new field
          const field = {};
          field['type'] = (document.getElementById('newFieldTypeSelect') as HTMLSelectElement).value;
          let fieldValue = '';
          // Read allowMultiValues early as it's used in multiple places
          const allowMultiValues = (document.getElementById('newFieldAllowMultiSelect') as HTMLInputElement).checked;

          if (field['type'] === 'multifield') {
            // Handle multifield: collect sub-fields configuration
            // sub_fields is now an object/map keyed by field name
            field['sub_fields'] = {};
            const subFieldRows = document.querySelectorAll('.multifield-subfield-row');
            let position = 0;
            subFieldRows.forEach(row => {
              const nameInput = row.querySelector('.multifield-subfield-name') as HTMLInputElement;
              const typeSelect = row.querySelector('.multifield-subfield-type') as HTMLSelectElement;
              const defaultInput = row.querySelector('.multifield-subfield-default') as HTMLInputElement;
              const descInput = row.querySelector('.multifield-subfield-description') as HTMLInputElement;
              const positionInput = row.querySelector('.multifield-subfield-position') as HTMLInputElement;

              const name = nameInput.value.trim();
              if (name) {
                const subField: Record<string, unknown> = {
                  type: typeSelect.value as ExtraFieldInputType,
                  position: position,
                };

                // Add default value if provided
                if (defaultInput.value.trim()) {
                  subField.default = defaultInput.value.trim();
                }

                // Add description if provided
                if (descInput.value.trim()) {
                  subField.description = descInput.value.trim();
                }

                // Add options if type is select
                if (typeSelect.value === 'select') {
                  const choiceInputs = row.querySelectorAll('.multifield-subfield-choice-input');
                  const choices: string[] = [];
                  choiceInputs.forEach(input => {
                    const val = (input as HTMLInputElement).value.trim();
                    if (val) choices.push(val);
                  });
                  if (choices.length > 0) {
                    subField.options = choices;
                  }
                }
                // Use the name as the key in the sub_fields object
                field['sub_fields'][name] = subField;
                position++;
              }
            });
            // Validate that at least one sub-field has a name
            if (Object.keys(field['sub_fields']).length === 0) {
              notify.error('multifield-needs-subfields');
              return;
            }
            // Initialize with one empty row
            field['value'] = [{}];
          } else if (field['type'] === 'text') {
            fieldValue = textAreaField.value.trim();
          } else if (['date', 'datetime-local', 'email', 'time', 'url', 'experiments', 'items', 'users', 'compounds'].includes(field['type'])) {
            fieldValue = (document.getElementById('newFieldValueInput') as HTMLInputElement).value.trim();
          } else if (['select', 'radio'].includes(field['type'])) {
            field['options'] = [];
            document.getElementById('choicesInputDiv').querySelectorAll('input').forEach(opt => field['options'].push(opt.value));
            // just take the first one as selected value
            fieldValue = field['options'][0];
          } else if (field['type'] === ExtraFieldInputType.Number) {
            fieldValue = (document.getElementById('newFieldValueInput') as HTMLInputElement).value;
            field['units'] = [];
            document.getElementById('unitChoicesInputDiv').querySelectorAll('input').forEach(opt => {
              const unitValue = opt.value;
              // only add non empty values
              if (unitValue) {
                field['units'].push(unitValue);
              }
            });
            field['unit'] = '';
            // if there is at least one value in "units", add it to "unit"
            if (field['units'].length > 0) {
              field['unit'] = field['units'][0];
            }
          } else if (field['type'] === ExtraFieldInputType.Checkbox) {
            fieldValue = (document.getElementById('newFieldCheckboxDefaultSelect') as HTMLSelectElement).value === 'checked' ? 'on' : '';
          }

          // Set value for non-multifield types
          if (field['type'] !== ExtraFieldInputType.Multifield) {
            field['value'] = allowMultiValues ? [fieldValue || ''] : (fieldValue || '');
          }
          // get the description
          if ((document.getElementById('newFieldDescriptionInput') as HTMLInputElement).value) {
            field['description'] = (document.getElementById('newFieldDescriptionInput') as HTMLInputElement).value.trim();
          }
          // deal with the blank_on_value
          if ((document.getElementById('blankValueOnDuplicateSwitch') as HTMLInputElement).checked) {
            field['blank_value_on_duplicate'] = true;
          }
          if ((document.getElementById('requiredSwitch') as HTMLInputElement).checked) {
            field['required'] = true;
          }
          // Always set allow_multi_values for multifield to control row behavior
          field['allow_multi_values'] = allowMultiValues;
          if (grpSel.value !== '-1') {
            field['group_id'] = parseInt(grpSel.value);
          }

          json['extra_fields'][fieldKey] = field;

          // jQuery selector required for .modal()
          MetadataC.update(json as ValidMetadata).then(() => {
            // store the currently selected group before reset, to maintain selection when adding a new input
            const selectedGroup = grpSel.value;
            clearForm();
            // restore original value
            grpSel.value = selectedGroup;
            // and finally close the modal
            $('#fieldBuilderModal').modal('toggle');
            // focus on the newly added element
            document.querySelector(`#metadataDiv [data-name="${CSS.escape(fieldKey)}"]`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          });
        });
      // EDIT EXTRA FIELD
      } else if (el.matches('[data-action="edit-extra-field"]')) {
        // prevent form invalid data
        if ((document.getElementById('newFieldForm') as HTMLFormElement).reportValidity() === false) {
          notify.error('form-validation-error');
          return;
        }
        // get field to update's current value
        const fieldNameInput = document.getElementById('newFieldKeyInput') as HTMLInputElement;
        const originalFieldKey = fieldNameInput.dataset.name; // store previous key
        const newFieldKeyValue = fieldNameInput.value.trim(); // new key from input
        const newFieldKey = normalizeFieldName(newFieldKeyValue);

        let json = {};
        MetadataC.read().then(metadata => {
          if (metadata) {
            json = metadata;
          }
          // if the extra field's name (also acting as key) is updated, replace existing entry and keep the content
          const prevField = json['extra_fields']?.[
            originalFieldKey && originalFieldKey !== newFieldKey ? originalFieldKey : newFieldKey
          ];
          const field = {};
          // handle field inputs : type, desc, and different type values
          field['type'] = (document.getElementById('newFieldTypeSelect') as HTMLSelectElement).value;
          if (grpSel.value !== '-1') {
            field['group_id'] = parseInt(grpSel.value);
          }
          const fieldDescriptionInput = document.getElementById('newFieldDescriptionInput') as HTMLInputElement;
          if (fieldDescriptionInput.value) {
            field['description'] = fieldDescriptionInput.value.trim();
          }
          // handle values depending on type
          if (field['type'] === ExtraFieldInputType.Text) {
            field['value'] = textAreaField.value.trim();
          } else if (['date', 'datetime-local', 'email', 'time', 'url'].includes(field['type'])) {
            const val = (document.getElementById('newFieldValueInput') as HTMLInputElement).value.trim();
            field['value'] = val || prevField?.value || '';
          } else if ([ExtraFieldInputType.Users, ExtraFieldInputType.Items, ExtraFieldInputType.Experiments, ExtraFieldInputType.Compounds].includes(field['type'])) {
            const elId = `newField${field['type']}Input`;
            const el = document.getElementById(elId) as HTMLInputElement | null;
            const val = (el?.value ?? '').trim();
            field['value'] = val || prevField?.value || '';
          } else if ([ExtraFieldInputType.Select, ExtraFieldInputType.Radio].includes(field['type'])) {
            const prevVal = Array.isArray(prevField?.value) ? prevField.value[0] ?? '' : (prevField?.value || '');
            field['options'] = [];
            document.getElementById('choicesInputDiv').querySelectorAll('input').forEach(opt => {
              const val = (opt as HTMLInputElement).value.trim();
              if (val) field['options'].push(val);
            });
            // keep old value if no new option is provided
            field['value'] = field['options'].includes(prevVal) ? prevVal : (field['options'][0] || '');
          } else if (field['type'] === ExtraFieldInputType.Number) {
            const prevVal = Array.isArray(prevField?.value) ? prevField.value[0] ?? '' : (prevField?.value || '');
            const val = (document.getElementById('newFieldValueInput') as HTMLInputElement).value.trim();
            field['value'] = val || prevVal;
            field['units'] = [];
            document.getElementById('unitChoicesInputDiv').querySelectorAll('input').forEach(opt => {
              if (opt.value.trim()) {
                field['units'].push(opt.value.trim());
              }
            });
            const prevUnit = prevField?.unit || '';
            field['unit'] = field['units'].length === 0
              ? prevUnit
              : (field['units'].includes(prevUnit) ? prevUnit : field['units'][0]);
          } else if (field['type'] === ExtraFieldInputType.Checkbox) {
            field['value'] = (document.getElementById('newFieldCheckboxDefaultSelect') as HTMLSelectElement).value === 'checked' ? 'on' : '';
          } else if (field['type'] === ExtraFieldInputType.Multifield) {
            // Handle multifield: collect sub-fields configuration
            // sub_fields is now an object/map keyed by field name
            field['sub_fields'] = {};
            const subFieldRows = document.querySelectorAll('.multifield-subfield-row');
            let position = 0;
            subFieldRows.forEach(row => {
              const nameInput = row.querySelector('.multifield-subfield-name') as HTMLInputElement;
              const typeSelect = row.querySelector('.multifield-subfield-type') as HTMLSelectElement;
              const defaultInput = row.querySelector('.multifield-subfield-default') as HTMLInputElement;
              const descInput = row.querySelector('.multifield-subfield-description') as HTMLInputElement;
              const positionInput = row.querySelector('.multifield-subfield-position') as HTMLInputElement;

              const name = nameInput.value.trim();
              if (name) {
                const subField: Record<string, unknown> = {
                  type: typeSelect.value as ExtraFieldInputType,
                  position: position,
                };

                // Add default value if provided
                if (defaultInput.value.trim()) {
                  subField.default = defaultInput.value.trim();
                }

                // Add description if provided
                if (descInput.value.trim()) {
                  subField.description = descInput.value.trim();
                }

                // Add options if type is select
                if (typeSelect.value === 'select') {
                  const choiceInputs = row.querySelectorAll('.multifield-subfield-choice-input');
                  const choices: string[] = [];
                  choiceInputs.forEach(input => {
                    const val = (input as HTMLInputElement).value.trim();
                    if (val) choices.push(val);
                  });
                  if (choices.length > 0) {
                    subField.options = choices;
                  }
                }
                // Use the name as the key in the sub_fields object
                field['sub_fields'][name] = subField;
                position++;
              }
            });
            // Validate that at least one sub-field has a name
            if (Object.keys(field['sub_fields']).length === 0) {
              notify.error('multifield-needs-subfields');
              return;
            }
            // Preserve the existing value structure
            field['value'] = prevField?.value || [{}];
            // deal with modal SWITCHES (key: id, value: field's 'value')
            const switches: Record<string, string> = {
              blankValueOnDuplicateSwitch: 'blank_value_on_duplicate',
              requiredSwitch: 'required',
              newFieldAllowMultiSelect: 'allow_multi_values',
            };
            for (const [id, key] of Object.entries(switches)) {
              const el = document.getElementById(id) as HTMLInputElement | null;
              if (el?.checked) field[key] = true;
            }
          } else {
            // deal with modal SWITCHES (key: id, value: field's 'value')
            const switches: Record<string, string> = {
              blankValueOnDuplicateSwitch: 'blank_value_on_duplicate',
              requiredSwitch: 'required',
              newFieldAllowMultiSelect: 'allow_multi_values',
            };
            for (const [id, key] of Object.entries(switches)) {
              const el = document.getElementById(id) as HTMLInputElement | null;
              if (el?.checked) field[key] = true;
            }

            const allowMultiValues = (document.getElementById('newFieldAllowMultiSelect') as HTMLInputElement).checked;
            const firstValue = Array.isArray(field['value']) ? field['value'][0] ?? '' : (field['value'] ?? '');
            if (allowMultiValues) {
              if (Array.isArray(prevField?.value) && (prevField.type ?? 'text') === field['type']) {
                let values = [...prevField.value];
                if (values.length === 0) {
                  values.push(firstValue);
                } else {
                  values[0] = firstValue;
                }
                if (['select', 'radio'].includes(field['type'])) {
                  values = values.filter(value => field['options'].includes(String(value)));
                }
                field['value'] = values;
              } else {
                field['value'] = [firstValue];
              }
            } else if (Array.isArray(field['value'])) {
              field['value'] = firstValue;
            }
          }

          // preserve properties that aren't editable in this modal
          if (prevField?.readonly === true) field['readonly'] = true;
          if (typeof prevField?.position === 'number') field['position'] = prevField.position;
          if (Array.isArray(prevField?.value_labels)) field['value_labels'] = prevField.value_labels;
          // ensure the old extra field is replaced
          if (!json['extra_fields']) json['extra_fields'] = {};
          if (originalFieldKey && originalFieldKey !== newFieldKey) {
            delete json['extra_fields'][originalFieldKey];
          }
          json['extra_fields'][newFieldKey] = field;

          MetadataC.update(json as ValidMetadata).then(() => {
            $('#fieldBuilderModal').modal('toggle');
            // focus on the newly added element
            document.querySelector(`#metadataDiv [data-name="${CSS.escape(newFieldKey)}"]`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          });
        });
      // ADD OPTION FOR SELECT OR RADIO
      } else if (el.matches('[data-action="new-field-add-option"]')) {
        const newGroup = document.createElement('div');
        newGroup.classList.add('input-group', 'mb-1');
        const newInput = document.createElement('input');
        newInput.setAttribute('aria-labelledby', 'choicesInputLabel');
        // the is-extra-input class is used to remove them upon save
        newInput.classList.add('form-control', 'is-extra-input');
        const appendDiv = document.createElement('div');
        appendDiv.classList.add('input-group-append');
        const btn = createButton('remove-self','btn-secondary','-');
        appendDiv.appendChild(btn);

        newGroup.appendChild(newInput);
        newGroup.appendChild(appendDiv);
        el.parentElement.querySelector('div').append(newGroup);
      // REMOVE INPUT FROM MULTI INPUT TYPES (DROPDOWN, RADIO)
      } else if (el.matches('[data-action="remove-self"]')) {
        el.parentElement.parentElement.remove();
      // SAVE NEW GROUP
      } else if (el.matches('[data-action="save-new-fields-group"]')) {
        const nameInput = (document.getElementById('newFieldsGroupKeyInput') as HTMLInputElement);

        // get the current metadata
        MetadataC.read().then((metadata: ValidMetadata) => {
          // make sure we have an elabftw property
          if (!Object.prototype.hasOwnProperty.call(metadata, 'elabftw')) {
            metadata['elabftw'] = {};
          }
          // default groupid
          let groupId = 1;
          if (Object.prototype.hasOwnProperty.call(metadata.elabftw, 'extra_fields_groups')) {
            // find out what will be the next group id by looking for the highest group.id and adding 1
            groupId = metadata.elabftw.extra_fields_groups.reduce((prev, current) => {
              return (prev.id > current.id) ? prev : current;
            }).id + 1;
          } else {
            // create an empty array if no groups exist
            metadata.elabftw.extra_fields_groups = [];
          }

          const grpOption = document.createElement('option');
          grpOption.value = String(groupId);
          grpOption.text = nameInput.value;
          grpSel.add(grpOption);
          // select the freshly added group because it is the most likely to be picked now that we just added it
          grpSel.selectedIndex = grpSel.options.length - 1;

          // save the new group in metadata
          metadata.elabftw.extra_fields_groups.push({'id': groupId, 'name': nameInput.value});
          // Display new groups and allow editing/deleting them
          const fieldsGroup = document.getElementById('fieldsGroup') as HTMLElement;
          // don't use the update method because we don't need to refresh the inputs
          MetadataC.save(metadata).then(() => {
            const newInputGroup: HTMLDivElement = document.createElement('div');
            newInputGroup.classList.add('input-group', 'mb-1');
            newInputGroup.setAttribute('data-target', 'group-item');
            newInputGroup.setAttribute('data-group-id', String(groupId));

            const inputEl: HTMLInputElement = document.createElement('input');
            inputEl.classList.add('form-control', 'group-name-input');
            inputEl.setAttribute('value', grpOption.text);
            inputEl.setAttribute('data-target', 'group-item');

            const appendDiv = document.createElement('div');
            appendDiv.classList.add('input-group-append');

            const updateButton = createButton('update-fields-group', 'btn-primary');
            const deleteButton = createButton('remove-fields-group', 'btn-secondary');
            const saveIcon = document.createElement('i');
            saveIcon.classList.add('fas', 'fa-save');
            updateButton.appendChild(saveIcon);
            const deleteIcon = document.createElement('i');
            deleteIcon.classList.add('fas', 'fa-trash-alt');
            deleteButton.appendChild(deleteIcon);
            // Append buttons to the appendDiv
            appendDiv.appendChild(updateButton);
            appendDiv.appendChild(deleteButton);
            // Append input and appendDiv to the main groupDiv
            newInputGroup.appendChild(inputEl);
            newInputGroup.appendChild(appendDiv);
            // Append the groupDiv to the parent container
            fieldsGroup.appendChild(newInputGroup);
          });
          // clear input value
          nameInput.value = '';
        });
        // EDIT GROUP
      } else if (el.matches('[data-action="update-fields-group"]')) {
        const groupDiv: HTMLDivElement = el.closest('[data-target="group-item"]');
        const groupId: number = parseInt(groupDiv.dataset.groupId, 10);
        const nameInput = groupDiv.querySelector('.group-name-input') as HTMLInputElement;
        const updatedGroupName = nameInput.value.trim();

        MetadataC.read().then((metadata: ValidMetadata) => {
          const group = metadata.elabftw.extra_fields_groups.find(group => group.id === groupId);
          group.name = updatedGroupName;

          // Update the group in the <select> dropdown
          const optionToUpdate = grpSel.querySelector(`option[value="${groupId}"]`);
          if (optionToUpdate) {
            optionToUpdate.textContent = updatedGroupName;
          }

          MetadataC.update(metadata as ValidMetadata);
        });
        // DELETE GROUP
      } else if (el.matches('[data-action="remove-fields-group"]')) {
        if (!confirm(i18next.t('generic-delete-warning'))) return;

        MetadataC.read().then((metadata: ValidMetadata) => {
          const groupDiv: HTMLDivElement = el.closest('[data-target="group-item"]');
          const groupId: number = parseInt(groupDiv.dataset.groupId, 10);

          // Check if group exists in metadata
          const groupIndex: number = metadata.elabftw.extra_fields_groups.findIndex(group => group.id === groupId);
          if (groupIndex === -1) {
            notify.error('not-found');
            return;
          }

          // Remove the group from `extra_fields_groups`
          metadata.elabftw.extra_fields_groups.splice(groupIndex, 1);
          // move fields to "undefined" group
          if (metadata.extra_fields) {
            for (const key in metadata.extra_fields) {
              if (metadata.extra_fields[key].group_id === groupId) {
                delete metadata.extra_fields[key].group_id;
              }
            }
          }
          // cleanup empty structures
          MetadataC.cleanupMetadata(metadata);
          const optionToRemove = grpSel.querySelector(`option[value="${groupId}"]`);
          optionToRemove?.remove();
          groupDiv.remove();
          MetadataC.update(metadata as ValidMetadata);
        });
      }
    });

    // Add sub-field button handler for multifield
    let subFieldPosition = 0;
    document.getElementById('multifieldAddSubFieldBtn')?.addEventListener('click', () => {
      addMultifieldSubFieldRow('', 'text', undefined, '', '', subFieldPosition++);
    });
  }
}
