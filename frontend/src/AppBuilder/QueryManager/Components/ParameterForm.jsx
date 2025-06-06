import React, { useEffect, useState } from 'react';
import { Form, Popover, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Information from '@/_ui/Icon/solidIcons/Information';
import CodeHinter from '@/AppBuilder/CodeEditor';

const isValidVariableName = (str) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);

const ParameterForm = ({
  darkMode,
  isEdit,
  name: _name,
  defaultValue: _defaultValue,
  onSubmit,
  showModal,
  otherParams = [],
}) => {
  const [name, setName] = useState();
  const [defaultValue, setDefaultValue] = useState();
  const [error, setError] = useState();

  useEffect(() => {
    setName(_name);
    setDefaultValue(_defaultValue);
  }, [_name, _defaultValue, showModal]);

  useEffect(() => {
    if (!showModal && !error) {
      onSubmit && onSubmit({ name, defaultValue });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!error) {
      onSubmit && onSubmit({ name, defaultValue });
    }
  };

  useEffect(() => {
    if (!isValidVariableName(name)) {
      setError('Variable name invalid');
    } else if (name && otherParams.some((param) => param.name === name.trim())) {
      setError('Variable name exists');
    } else {
      setError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return (
    <>
      <Popover.Header className={`${darkMode && 'dark-theme'}`}>
        <p className="tj-text-xsm " style={{ fontWeight: '600' }}>
          {isEdit ? 'UPDATE PARAMETER' : 'ADD PARAMETER'}
        </p>
      </Popover.Header>
      <Popover.Body
        className={darkMode && 'dark-theme dark-theme'}
        key={'1'}
        bsPrefix="popover-body"
        style={{ padding: '16px 16px 32px 16px', overflowY: 'auto' }}
      >
        <Form
          className="container p-0 tj-app-input"
          onSubmit={handleSubmit}
          style={{ paddingRight: '25px !important' }}
        >
          <Form.Group as={Col} style={{ display: 'flex' }} className="mb-2 pr-1">
            <Form.Label column htmlFor="paramName">
              Name
            </Form.Label>
            <Col>
              <Form.Control
                style={{ height: '32px', width: '177px' }}
                type="text"
                aria-describedby="paramName"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              {name && error && <div className="invalid-feedback d-block">{error}</div>}
            </Col>
          </Form.Group>
          <Form.Group as={Col} style={{ display: 'flex' }}>
            <Form.Label column htmlFor="defaultValue" style={{ marginRight: '0px' }}>
              Value
              <span className="ms-1">
                <OverlayTrigger
                  placement="bottom"
                  overlay={
                    <Tooltip id="tooltip">
                      Exposed values such as components, queries, globals etc are not supported in this field.Please use
                      constant strings, numbers or objects.
                    </Tooltip>
                  }
                >
                  <span>
                    <Information width="15" fill="var(--indigo9)" />
                  </span>
                </OverlayTrigger>
              </span>
            </Form.Label>
            <Col style={{ padding: '0px', width: '177px' }}>
              <div className="d-flex">
                <div className="" style={{ height: '32px', width: '177px' }}>
                  <CodeHinter
                    onChange={(value) => setDefaultValue(value)}
                    theme={darkMode ? 'monokai' : 'default'}
                    usePortalEditor={false}
                    style={{ height: '32px', width: '177px', marginBotto: '16px' }}
                    initialValue={defaultValue}
                    delayOnChange={false}
                  />
                </div>
              </div>
            </Col>
          </Form.Group>
        </Form>
      </Popover.Body>
    </>
  );
};

export default ParameterForm;
